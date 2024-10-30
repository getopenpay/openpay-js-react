import {
  AllFieldNames,
  CheckoutPaymentMethod,
  convertStylesToQueryString,
  ElementProps,
  FieldName,
  PaymentRequestStatus,
} from '@getopenpay/utils';
import { OpenPayFormEventHandler } from './event';
import { ConnectionManager, createConnection } from './utils/connection';
import { initializePaymentRequests } from './utils/payment-request';

export { FieldName };

export type ElementType = 'card' | 'card-number' | 'card-expiry' | 'card-cvc';

export type ElementsFormProps = {
  className?: string;
  checkoutSecureToken: string;
  onFocus?: (elementId: string, field: AllFieldNames) => void;
  onBlur?: (elementId: string, field: AllFieldNames) => void;
  onChange?: (elementId: string, field: AllFieldNames, errors?: string[]) => void;
  onLoad?: (totalAmountAtoms?: number, currency?: string) => void;
  onLoadError?: (message: string) => void;
  onValidationError?: (field: AllFieldNames, errors: string[], elementId?: string) => void;
  onCheckoutStarted?: () => void;
  onCheckoutSuccess?: (invoiceUrls: string[], subscriptionIds: string[], customerId: string) => void;
  onSetupPaymentMethodSuccess?: (paymentMethodId: string) => void;
  onCheckoutError?: (message: string) => void;
  baseUrl?: string;
  formTarget?: string;
  onPaymentRequestLoad?: (paymentRequests: Record<'apple_pay' | 'google_pay', PaymentRequestStatus>) => void;
};

export type Config = ElementsFormProps & { _frameUrl?: URL };

export class OpenPayForm {
  config: Config;
  formId: string;
  sessionId: null | string;
  checkoutPaymentMethods: Array<CheckoutPaymentMethod>;
  formTarget: string;
  checkoutFired: boolean;
  private referer: string;
  private eventHandler: OpenPayFormEventHandler;
  private formProperties: { height: string };
  private connectionManager: ConnectionManager;
  private paymentRequests: Record<'apple_pay' | 'google_pay', PaymentRequestStatus>;
  private elements: Record<
    ElementType,
    { type: ElementType; node: HTMLIFrameElement; mount: (selector: string) => void }
  > | null;

  constructor(config: Config) {
    this.config = { ...config, baseUrl: config.baseUrl ?? 'https://cde.getopenpay.com' };
    this.elements = null;
    this.formId = `opjs-form-${window.crypto.randomUUID()}`;
    this.referer = window.location.origin;
    this.formTarget = config.formTarget ?? 'body';
    this.formProperties = { height: '1px' };
    this.sessionId = null;
    this.checkoutPaymentMethods = [];
    this.checkoutFired = false;
    this.paymentRequests = this.initPaymentRequests();
    this.connectionManager = new ConnectionManager();
    this.eventHandler = new OpenPayFormEventHandler(this);

    const ojs_version = { version: __APP_VERSION__ };
    // @ts-expect-error window typing
    window['ojs_version'] = ojs_version;

    window.addEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  }

  public getConnectionManager() {
    return this.connectionManager;
  }

  public setFormHeight(height: string) {
    this.formProperties.height = height;
    if (this.elements) {
      Object.values(this.elements).forEach((element) => {
        element.node.style.height = height;
      });
    }
  }

  private initPaymentRequests(): Record<'apple_pay' | 'google_pay', PaymentRequestStatus> {
    return {
      apple_pay: { isLoading: true, isAvailable: false, startFlow: async () => {} },
      google_pay: { isLoading: true, isAvailable: false, startFlow: async () => {} },
    };
  }

  createElement(type: ElementType, options: ElementProps = {}) {
    if (!this.config) throw new Error('OpenPay form not initialized');

    const frame = document.createElement('iframe');
    const queryString = this.buildQueryString(options);

    frame.name = `${type}-element`;
    const url = new URL(`/app/v1/${frame.name}`, this.config.baseUrl);
    url.search = queryString.toString();
    frame.src = url.href;
    this.config._frameUrl = url;
    frame.style.border = 'none';
    frame.style.width = '100%';

    const element = {
      type,
      node: frame,
      mount: (selector: string) => document.querySelector(selector)?.appendChild(frame),
    };

    this.connectToElement(element);
    if (this.elements) {
      this.elements[type] = element;
    } else {
      this.elements = { [type]: element } as OpenPayForm['elements'];
    }

    return element;
  }

  private buildQueryString(options: ElementProps): URLSearchParams {
    const queryString = new URLSearchParams();
    queryString.append('referer', this.referer);
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
        this.initializePaymentRequests();
      })
      .catch((err) => console.error('[FORM] Error connecting to CDE iframe', err));
  }

  submit() {
    this.eventHandler.handleFormSubmit();
  }

  onPaymentRequestError(errMsg: string): void {
    console.error('[form] Error from payment request:', errMsg);
    this.checkoutFired = false;
    if (this.config.onCheckoutError) this.config.onCheckoutError(errMsg);
  }

  private async initializePaymentRequests() {
    if (!this.config.checkoutSecureToken || !this.checkoutPaymentMethods || !this.formTarget) return;

    const cdeConn = this.connectionManager.getConnection();
    if (!cdeConn) {
      console.error('[form] CDE connection not established');
      return;
    }

    this.paymentRequests = await initializePaymentRequests(
      this.config,
      this.checkoutPaymentMethods,
      cdeConn,
      this.eventHandler.onUserCompletePaymentRequestUI.bind(this.eventHandler),
      this.config.onValidationError,
      this.onPaymentRequestError.bind(this)
    );

    if (this.config.onPaymentRequestLoad) {
      this.config.onPaymentRequestLoad(this.paymentRequests);
    }
  }

  destroy() {
    for (const element of Object.values(this.elements ?? {})) {
      element.node.remove();
    }
    window.removeEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  }
}
