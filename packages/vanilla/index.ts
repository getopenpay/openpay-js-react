import {
  convertStylesToQueryString,
  createInputsDictFromForm,
  ElementProps,
  ElementType,
  FieldName,
  findCheckoutPaymentMethodStrict,
  OjsContext,
  OjsFlows,
  makeCallbackSafe,
  initializeOjsFlows,
  OjsFlowsInitialization,
  PR_LOADING,
  PR_ERROR,
  PaymentRequestStartParams,
  LoadedEventPayload,
  ElementTypeEnumValue,
  FRAME_BASE_URL,
  ElementTypeEnum,
  PaymentRequestProvider,
} from '@getopenpay/utils';
import { OpenPayFormEventHandler } from './event';
import { ConnectionManager, createConnection } from './utils/connection';
import { InitStripePrFlowResult, InitStripePrFlowSuccess } from '@getopenpay/utils/src/flows/stripe/stripe-pr-flow';
import { Loadable } from '@getopenpay/utils/src/flows/common/common-flow-utils';
import { CustomInitParams } from '@getopenpay/utils/src/flows/ojs-flow';
import { FormCallbacks, parseFormCallbacks } from '@getopenpay/utils/src/form-callbacks';
export { FieldName };

export type ElementsFormProps = {
  className?: string;
  checkoutSecureToken: string;
  baseUrl?: string;
  formTarget?: string;
  customInitParams?: CustomInitParams;
};

export type Config = ElementsFormProps & { _frameUrl?: URL } & FormCallbacks;
type RegisteredElement = { type: ElementType; node: HTMLIFrameElement; mount: (selector: string) => void };

export class OpenPayForm {
  config: Config;
  formId: string;
  formTarget: string;
  checkoutFired: boolean;
  ojsVersion: string;
  ojsReleaseVersion: string;
  formProperties: { height: string };
  referrer: string;
  readonly baseUrl: string;
  readonly formCallbacks: FormCallbacks;
  private eventHandler: OpenPayFormEventHandler;
  private connectionManager: ConnectionManager;
  private ojsFlowsInitialization: OjsFlowsInitialization | null;
  private cdeLoadedPayload: LoadedEventPayload | null;
  private registeredElements: Record<ElementType, RegisteredElement | undefined> | null;
  // For easier debugging
  static ojsFlows: typeof OjsFlows = OjsFlows;

  constructor(config: Config) {
    OpenPayForm.assignAsSingleton(this);
    this.baseUrl = config.baseUrl ?? 'https://cde.getopenpay.com';
    this.config = { ...config, baseUrl: this.baseUrl };
    this.formCallbacks = parseFormCallbacks(config);
    this.registeredElements = null;
    this.formId = `opjs-form-${window.crypto.randomUUID()}`;
    this.referrer = window.location.origin;
    this.formTarget = config.formTarget ?? 'body';
    this.formProperties = { height: '1px' };
    this.cdeLoadedPayload = null;
    this.ojsFlowsInitialization = null;
    this.checkoutFired = false;
    this.connectionManager = new ConnectionManager();
    this.eventHandler = new OpenPayFormEventHandler(this);
    this.ojsVersion = __APP_VERSION__;
    this.ojsReleaseVersion = __RELEASE_VERSION__;

    window.addEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  }

  /**
   * Assign the instance to the window as a singleton
   * @param form - The OpenPayForm instance
   */
  private static assignAsSingleton(form: OpenPayForm) {
    if (OpenPayForm.getInstance()) {
      throw new Error('OpenPay instance already exists. Only one instance is allowed.');
    }
    // @ts-expect-error window typing
    window['ojs'] = form;
  }

  /**
   * Get the singleton instance of OpenPayForm
   * @returns The OpenPayForm instance
   */
  static getInstance(): OpenPayForm | null {
    // @ts-expect-error window typing
    return window['ojs'] ?? null;
  }

  public get checkoutSecureToken() {
    return this.config.checkoutSecureToken;
  }

  public getConnectionManager() {
    return this.connectionManager;
  }

  public setFormHeight(height: string) {
    this.formProperties.height = height;
    if (this.registeredElements) {
      Object.values(this.registeredElements).forEach((element) => {
        if (!element) return;
        element.node.style.height = height;
      });
    }
  }

  tryInitOjsFlows = () => {
    if (this.ojsFlowsInitialization !== null) {
      return;
    }
    if (!this.cdeLoadedPayload) {
      return;
    }
    if (this.connectionManager.getAllConnections().size === 0) {
      return;
    }
    this.ojsFlowsInitialization = initializeOjsFlows(this.createOjsFlowContext(), this.createOjsFlowCallbacks());
    this.ojsFlowsInitialization.stripePR.subscribe((status) => this.onStripePRStatusChange(status));
  };

  onCdeLoaded = (payload: LoadedEventPayload) => {
    if (this.cdeLoadedPayload) {
      return;
    }
    this.cdeLoadedPayload = payload;
    this.tryInitOjsFlows();
  };

  onStripePRStatusChange = (initStatus: Loadable<InitStripePrFlowResult>) => {
    if (initStatus.status === 'loading') {
      this.formCallbacks.onPaymentRequestLoad?.({ apple_pay: PR_LOADING, google_pay: PR_LOADING });
    } else if (initStatus.status === 'error') {
      this.formCallbacks.onPaymentRequestLoad?.({ apple_pay: PR_ERROR, google_pay: PR_ERROR });
    } else if (initStatus.status === 'loaded') {
      const initResult = initStatus.result;
      const canApplePay = initResult.isAvailable && initResult.availableProviders.applePay;
      const canGooglePay = initResult.isAvailable && initResult.availableProviders.googlePay;
      this.formCallbacks.onPaymentRequestLoad?.({
        apple_pay: {
          isLoading: false,
          isAvailable: canApplePay,
          startFlow: async (userParams) =>
            canApplePay ? this.submitPaymentRequest('apple_pay', initResult, userParams) : undefined,
        },
        google_pay: {
          isLoading: false,
          isAvailable: canGooglePay,
          startFlow: async (userParams) =>
            canGooglePay ? this.submitPaymentRequest('google_pay', initResult, userParams) : undefined,
        },
      });
    }
  };

  createElement(elementValue: ElementTypeEnumValue, options: ElementProps = {}) {
    if (!this.config) throw new Error('OpenPay form not initialized');
    const type = ElementType.parse(elementValue);

    const frame = document.createElement('iframe');
    const queryString = this.buildQueryString(options);

    frame.name = `${type}-element`;
    const url = new URL(`/app/v1/${frame.name}`, this.config.baseUrl);
    url.search = queryString.toString();
    frame.src = url.href;
    this.config._frameUrl = url;
    frame.style.border = 'none';
    frame.style.width = '100%';

    const registeredElement = this.registerIframe(type, frame);
    return registeredElement;
  }

  registerIframe(type: ElementTypeEnum, frame: HTMLIFrameElement): RegisteredElement {
    const element: RegisteredElement = {
      type,
      node: frame,
      mount: (selector: string) => document.querySelector(selector)?.appendChild(frame),
    };
    this.connectToElement({ type: element.type, node: element.node });
    if (!this.registeredElements) {
      this.registeredElements = {
        [ElementTypeEnum.CARD]: undefined,
        [ElementTypeEnum.CARD_NUMBER]: undefined,
        [ElementTypeEnum.CARD_EXPIRY]: undefined,
        [ElementTypeEnum.CARD_CVC]: undefined,
      };
    }
    this.registeredElements[type] = element;
    return element;
  }

  private buildQueryString(options: ElementProps): URLSearchParams {
    const queryString = new URLSearchParams();
    queryString.append('referer', this.referrer);
    queryString.append('formId', this.formId);
    if (options.styles) {
      queryString.append('styles', convertStylesToQueryString(options.styles));
    }
    queryString.append('secureToken', this.config.checkoutSecureToken);
    return queryString;
  }

  private connectToElement(element: { type: ElementType; node: HTMLIFrameElement }) {
    createConnection(element.node)
      .then((conn) => {
        this.connectionManager.addConnection(element.type, conn);
        this.tryInitOjsFlows();
      })
      .catch((err) => console.error('[FORM] Error connecting to CDE iframe', err));
  }

  private getFormDiv(): HTMLElement {
    return document.querySelector(this.formTarget) ?? document.body;
  }

  private createOjsFlowContext(): OjsContext {
    const cdeConnections = this.connectionManager.getAllConnections();
    if (!this.cdeLoadedPayload) {
      throw new Error('Requested context while CDE not yet loaded');
    }
    if (cdeConnections.size === 0) {
      throw new Error('No CDE connections found');
    }
    return {
      baseUrl: new URL(this.config.baseUrl ?? FRAME_BASE_URL).origin,
      formDiv: this.getFormDiv(),
      elementsSessionId: this.cdeLoadedPayload.sessionId,
      checkoutPaymentMethods: this.cdeLoadedPayload.checkoutPaymentMethods,
      cdeConnections,
      customInitParams: this.config.customInitParams ?? {},
    };
  }

  private createOjsFlowCallbacks() {
    const noOp = () => {};
    return {
      onCheckoutError: makeCallbackSafe('onCheckoutError', this.formCallbacks.onCheckoutError ?? noOp),
      onCheckoutStarted: makeCallbackSafe('onCheckoutStarted', this.formCallbacks.onCheckoutStarted ?? noOp),
      onCheckoutSuccess: makeCallbackSafe('onCheckoutSuccess', this.formCallbacks.onCheckoutSuccess ?? noOp),
      onSetupPaymentMethodSuccess: makeCallbackSafe(
        'onSetupPaymentMethodSuccess',
        this.formCallbacks.onSetupPaymentMethodSuccess ?? noOp
      ),
      onValidationError: makeCallbackSafe('onValidationError', this.formCallbacks.onValidationError ?? noOp),
    };
  }

  submitCard() {
    const context = this.createOjsFlowContext();
    OjsFlows.commonCC.run({
      context,
      checkoutPaymentMethod: findCheckoutPaymentMethodStrict(context.checkoutPaymentMethods, 'credit_card'),
      nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
      flowCallbacks: this.createOjsFlowCallbacks(),
      customParams: undefined, // This flow requires no custom params
      initResult: undefined, // This flow requires no initialization
    });
  }

  // Alias for submitCard
  submit = this.submitCard;

  submitPaymentRequest = (
    provider: PaymentRequestProvider,
    initResult: InitStripePrFlowSuccess,
    params?: PaymentRequestStartParams
  ): Promise<void> => {
    const context = this.createOjsFlowContext();
    return OjsFlows.stripePR.run({
      context,
      checkoutPaymentMethod: findCheckoutPaymentMethodStrict(context.checkoutPaymentMethods, provider),
      nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
      flowCallbacks: this.createOjsFlowCallbacks(),
      customParams: { provider, overridePaymentRequest: params?.overridePaymentRequest },
      initResult,
    });
  };

  onPaymentRequestError(errMsg: string): void {
    console.error('[form] Error from payment request:', errMsg);
    this.checkoutFired = false;
    if (this.formCallbacks.onCheckoutError) this.formCallbacks.onCheckoutError(errMsg);
  }

  destroy() {
    for (const element of Object.values(this.registeredElements ?? {})) {
      if (!element) continue;
      element.node.remove();
    }
    window.removeEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  }
}
