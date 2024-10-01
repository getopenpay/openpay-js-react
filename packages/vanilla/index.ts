import {
  CheckoutPaymentMethod,
  convertStylesToQueryString,
  ElementProps,
  ElementsFormProps,
  EventType,
  constructSubmitEventPayload,
  emitEvent,
  FieldName,
} from '@getopenpay/utils';
import { OpenPayFormEventHandler } from './event';
import { createConnection, ConnectionManager } from './utils/connection';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';

export { FieldName };

export type ElementType = 'card' | 'card-number' | 'card-expiry' | 'card-cvc';

export type Config = Omit<ElementsFormProps, 'children'> & {
  formTarget?: string;
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
}
