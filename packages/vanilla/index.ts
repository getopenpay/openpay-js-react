import {
  CheckoutPaymentMethod,
  convertStylesToQueryString,
  ElementProps,
  ElementsFormProps,
  EventType,
  constructSubmitEventPayload,
  emitEvent,
  FieldName,
  PaymentRequestStatus,
  PaymentRequestStartParams,
  createStripePaymentRequest,
  parseStripePubKey,
  waitForUserToAddPaymentMethod,
  getCheckoutPreview,
  getPrefill,
  OptionalString,
  Amount,
  getErrorMessage,
  CdeConnection,
  createInputsDictFromForm,
} from '@getopenpay/utils';
import { OpenPayFormEventHandler } from './event';
import { createConnection, ConnectionManager } from './utils/connection';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';

export { FieldName };

export type ElementType = 'card' | 'card-number' | 'card-expiry' | 'card-cvc';

export type Config = Omit<ElementsFormProps, 'children'> & {
  formTarget?: string;
  onPaymentRequestLoad?: (paymentRequests: Record<'apple_pay' | 'google_pay', PaymentRequestStatus>) => void;
};

export class OpenPayForm {
  config: Config;
  elements: Record<
    ElementType,
    {
      type: ElementType;
      node: HTMLIFrameElement;
      mount: (selector: string) => void;
    }
  > | null;
  formId: string;
  referer: string;
  eventHandler: OpenPayFormEventHandler;
  formProperties: {
    height: string;
  };
  sessionId: null | string;
  checkoutPaymentMethods: Array<CheckoutPaymentMethod>;
  formTarget: string;
  connectionManager: ConnectionManager;
  loaded: boolean;
  preventClose: boolean;
  checkoutFired: boolean;
  stripePm: PaymentRequestPaymentMethodEvent | undefined;
  paymentRequests: Record<'apple_pay' | 'google_pay', PaymentRequestStatus>;

  constructor(config: Config) {
    this.config = config;
    this.config.baseUrl = config.baseUrl ?? 'https://cde.getopenpay.com';
    this.elements = null;
    this.formId = `opjs-form-${window.crypto.randomUUID()}`;
    this.referer = window.location.origin;
    this.eventHandler = new OpenPayFormEventHandler(this);
    this.formTarget = config.formTarget ?? 'body';
    this.formProperties = new Proxy(
      {
        height: '1px',
      },
      {
        set: (target, prop, value) => {
          if (prop === 'height') {
            // console.log('Setting form height:', value);
            target[prop] = value;
            if (this.elements) {
              Object.values(this.elements).forEach((element) => {
                element.node.style.height = value;
              });
            }
            return true;
          }
          return false;
        },
      }
    );
    this.sessionId = null;
    this.checkoutPaymentMethods = [];
    this.connectionManager = new ConnectionManager();
    this.loaded = false;
    this.preventClose = false;
    this.checkoutFired = false;
    this.stripePm = undefined;

    this.paymentRequests = {
      apple_pay: {
        isLoading: true,
        isAvailable: false,
        startFlow: async () => {
          console.warn('Apple Pay is not yet initialized.');
        },
      },
      google_pay: {
        isLoading: true,
        isAvailable: false,
        startFlow: async () => {
          console.warn('Google Pay is not yet initialized.');
        },
      },
    };

    // Initialize payment requests

    window.addEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
    window.addEventListener('beforeunload', this.onBeforeUnload.bind(this));
  }

  private onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.preventClose) e.preventDefault();
  }

  createElement(type: ElementType, options: ElementProps = {}) {
    const frame = document.createElement('iframe');

    if (!this.config) {
      throw new Error('OpenPay form not initialized');
    }

    const queryString = new URLSearchParams();
    queryString.append('referer', this.referer);
    queryString.append('formId', this.formId);
    if (options.styles) {
      const styleString = convertStylesToQueryString(options.styles);
      queryString.append('styles', styleString);
    }
    queryString.append('secureToken', this.config.checkoutSecureToken);

    frame.name = `${type}-element`;
    frame.src = `${this.config.baseUrl}/app/v1/${type}-element/?${queryString.toString()}`;
    frame.style.border = 'none';
    frame.style.width = '100%';
    // frame.style.height = this.config.formHeight;

    const element = {
      type,
      node: frame,
      mount: (selector: string) => {
        document.querySelector(selector)?.appendChild(frame);
      },
    };
    if (this.elements) {
      this.elements[type] = element;
    } else {
      this.elements = { [type]: element } as OpenPayForm['elements'];
      createConnection(element.node)
        .then((conn) => {
          console.log('[FORM] Connected to CDE iframe', conn);
          this.connectionManager.addConnection(type, conn);
          this.initializePaymentRequests();
        })
        .catch((err) => {
          console.error('[FORM] Error connecting to CDE iframe', err);
        });
    }

    return element;
  }

  submit() {
    if (!this.config.onValidationError || !this.sessionId || !this.checkoutPaymentMethods) return;

    const cardCpm = this.checkoutPaymentMethods.find((cpm) => cpm.provider === 'credit_card');
    if (!cardCpm) {
      throw new Error('Card not available as a payment method in checkout');
    }

    const extraData = constructSubmitEventPayload(
      EventType.enum.TOKENIZE,
      this.sessionId,
      document.querySelector(this.formTarget) ?? document.body,
      this.config.onValidationError,
      cardCpm,
      false
    );
    if (!extraData) return;

    console.log('[form] Submitting form:', extraData);

    for (const [elementId, element] of Object.entries(this.eventHandler.eventTargets ?? {})) {
      console.log('[form] inside loop', elementId);
      emitEvent(element, this.formId, elementId, extraData, this.config.baseUrl!);
    }

    this.eventHandler.setExtraData(extraData);
  }

  async onUserCompletePaymentRequestUI(
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ): Promise<void> {
    if (!this.formTarget || !this.config.onValidationError || !this.sessionId || !this.checkoutPaymentMethods) return;

    for (const [elementId, element] of Object.entries(this.elements ?? {})) {
      const paymentFlowMetadata = {
        stripePmId: stripePm.paymentMethod.id,
      };
      const startPaymentFlowEvent = constructSubmitEventPayload(
        EventType.enum.START_PAYMENT_FLOW,
        this.sessionId,
        document.querySelector(this.formTarget) ?? document.body,
        this.config.onValidationError,
        checkoutPaymentMethod,
        false,
        paymentFlowMetadata
      );
      if (!startPaymentFlowEvent) continue;
      this.stripePm = stripePm;
      this.checkoutFired = true;
      this.eventHandler.setExtraData(startPaymentFlowEvent);
      emitEvent(element.node.contentWindow!, this.formId, elementId, startPaymentFlowEvent, this.config.baseUrl!);
      break;
    }
  }

  onPaymentRequestError(errMsg: string): void {
    console.error('[form] Error from payment request:', errMsg);
    this.checkoutFired = false;
    if (this.config.onCheckoutError) this.config.onCheckoutError(errMsg);
  }

  destroy() {
    window.removeEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
    window.removeEventListener('beforeunload', this.onBeforeUnload.bind(this));
  }

  private async initializePaymentRequests() {
    console.log('[form] Initializing payment requests');
    if (!this.config.checkoutSecureToken || !this.checkoutPaymentMethods || !this.formTarget) {
      console.log('[form] No secure token or checkout payment methods or form target');
      return;
    }

    const cdeConn = this.connectionManager.getConnection();
    if (!cdeConn) {
      console.error('[form] CDE connection not established');
      return;
    }

    for (const provider of ['apple_pay', 'google_pay'] as const) {
      try {
        const stripeXPrCpm = this.checkoutPaymentMethods.find(
          (cpm) => cpm.provider === provider && cpm.processor_name === 'stripe'
        );
        if (!stripeXPrCpm) {
          throw new Error(`${provider} is not available as a checkout method`);
        }
        const stripePubKey = parseStripePubKey(stripeXPrCpm.metadata);
        const isAvailable = await this.checkIfProviderIsAvailable(stripePubKey, provider);

        this.paymentRequests[provider] = {
          isLoading: false,
          isAvailable,
          startFlow: (params?: PaymentRequestStartParams) =>
            this.startPaymentRequestUserFlow(
              cdeConn,
              this.config.checkoutSecureToken!,
              document.querySelector(this.formTarget) as HTMLDivElement,
              stripeXPrCpm,
              stripePubKey,
              this.onUserCompletePaymentRequestUI.bind(this),
              this.config.onValidationError,
              this.onPaymentRequestError.bind(this),
              params
            ),
        };
      } catch (e) {
        console.error(e);
        this.paymentRequests[provider] = {
          isLoading: false,
          isAvailable: false,
          startFlow: async () => {
            console.error(`${provider} is not available.`);
          },
        };
      }
    }
    if (this.config.onPaymentRequestLoad) {
      this.config.onPaymentRequestLoad(this.paymentRequests);
    }
  }

  private async checkIfProviderIsAvailable(
    stripePubKey: string,
    provider: 'apple_pay' | 'google_pay'
  ): Promise<boolean> {
    const DUMMY_AMOUNT_ATOM = 1000; // Just to check if PR is available
    const testerPR = await createStripePaymentRequest(stripePubKey, DUMMY_AMOUNT_ATOM, 'usd');
    const canMakePayment = await testerPR.canMakePayment();
    testerPR.abort();
    if (!canMakePayment) {
      throw new Error(`Cannot make payment with ${provider} for this session`);
    }
    return canMakePayment[provider === 'apple_pay' ? 'applePay' : 'googlePay'];
  }

  private async startPaymentRequestUserFlow(
    cdeConn: CdeConnection,
    secureToken: string,
    formDiv: HTMLDivElement,
    stripeXPrCpm: CheckoutPaymentMethod,
    stripePubKey: string,
    onUserCompleteUIFlow: (
      stripePm: PaymentRequestPaymentMethodEvent,
      checkoutPaymentMethod: CheckoutPaymentMethod
    ) => void,
    onValidationError: undefined | ((field: FieldName, errors: string[], elementId?: string) => void),
    onError: (errMsg: string) => void,
    prStartParams: PaymentRequestStartParams | undefined
  ): Promise<void> {
    try {
      const formData = createInputsDictFromForm(formDiv, {});
      if (!this.validateFormFields(formDiv, onValidationError, stripeXPrCpm)) {
        return;
      }
      const prefill = await getPrefill(cdeConn);
      const isSetupMode = prefill.mode === 'setup';

      let amountForPR: Amount;
      if (isSetupMode) {
        amountForPR = prStartParams?.amountToDisplayForSetupMode ?? { amountAtom: 0, currency: 'usd' };
      } else {
        if (prStartParams?.amountToDisplayForSetupMode) {
          console.warn(
            `Warning: amountToDisplayForSetupMode passed in non-setup mode. This parameter will be ignored.`
          );
        }
        const promoCodeParsed = OptionalString.safeParse(formData[FieldName.PROMOTION_CODE]);
        if (!promoCodeParsed.success) {
          throw new Error(`Unknown promo code type: ${promoCodeParsed.error.message}`);
        }
        const checkoutPreview = await this.getCheckoutValue(cdeConn, secureToken, promoCodeParsed.data);
        amountForPR = { amountAtom: checkoutPreview.amountAtom, currency: checkoutPreview.currency };
      }

      const pr = await createStripePaymentRequest(
        stripePubKey,
        amountForPR.amountAtom,
        amountForPR.currency,
        isSetupMode
      );
      await pr.canMakePayment(); // Required
      pr.show();
      const pmAddedEvent = await waitForUserToAddPaymentMethod(pr);
      onUserCompleteUIFlow(pmAddedEvent, stripeXPrCpm);
    } catch (e) {
      console.error(e);
      onError(getErrorMessage(e));
    }
  }

  // private createInputsDictFromForm(formDiv: HTMLDivElement): Record<string, string> {
  //   const inputs = formDiv.querySelectorAll('input, select, textarea');
  //   const formData: Record<string, string> = {};
  //   inputs.forEach((input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
  //     formData[input.name] = input.value;
  //   });
  //   return formData;
  // }

  private validateFormFields(
    formDiv: HTMLDivElement,
    onValidationError: undefined | ((field: FieldName, errors: string[], elementId?: string) => void),
    stripeXPrCpm: CheckoutPaymentMethod
  ): boolean {
    const startPaymentFlowEvent = constructSubmitEventPayload(
      EventType.enum.START_PAYMENT_FLOW,
      'dummy',
      formDiv,
      onValidationError ?? (() => {}),
      stripeXPrCpm,
      false
    );
    return !!startPaymentFlowEvent;
  }

  private async getCheckoutValue(
    cdeConn: CdeConnection,
    secureToken: string,
    promoCode: string | undefined
  ): Promise<{ currency: string; amountAtom: number }> {
    const checkoutPreview = await getCheckoutPreview(cdeConn, {
      secure_token: secureToken,
      promotion_code: promoCode,
    });
    const currencies = new Set(checkoutPreview.preview.invoices.map((inv) => inv.currency));
    if (currencies.size !== 1) {
      throw new Error(`Expected exactly one currency, got ${currencies.size}`);
    }
    const currency = currencies.values().next().value as string;
    const amountAtom = checkoutPreview.preview.invoices.reduce((sum, inv) => sum + inv.remaining_amount_atom, 0);
    return {
      currency,
      amountAtom,
    };
  }
}
