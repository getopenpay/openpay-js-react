import {
  AllFieldNames,
  CheckoutPaymentMethod,
  convertStylesToQueryString,
  createInputsDictFromForm,
  ElementProps,
  ElementType,
  FieldName,
  findCheckoutPaymentMethodStrict,
  OjsContext,
  OjsFlows,
  PaymentRequestStatus,
  makeCallbackSafe,
} from '@getopenpay/utils';
import { OpenPayFormEventHandler } from './event';
import { ConnectionManager, createConnection } from './utils/connection';
import { PaymentRequestProvider } from './utils/payment-request';
export { FieldName };

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
  // TODO ASAP: call this
  onPaymentRequestLoad?: (paymentRequests: Record<PaymentRequestProvider, PaymentRequestStatus>) => void;
};

export type Config = ElementsFormProps & { _frameUrl?: URL };

export class OpenPayForm {
  config: Config;
  formId: string;
  sessionId: null | string;
  checkoutPaymentMethods: Array<CheckoutPaymentMethod>;
  formTarget: string;
  checkoutFired: boolean;
  ojsVersion: string;
  private referer: string;
  private eventHandler: OpenPayFormEventHandler;
  private formProperties: { height: string };
  private connectionManager: ConnectionManager;
  private elements: Record<
    ElementType,
    { type: ElementType; node: HTMLIFrameElement; mount: (selector: string) => void }
  > | null;
  // For easier debugging
  static ojsFlows: typeof OjsFlows = OjsFlows;

  constructor(config: Config) {
    OpenPayForm.assignAsSingleton(this);
    this.config = { ...config, baseUrl: config.baseUrl ?? 'https://cde.getopenpay.com' };
    this.elements = null;
    this.formId = `opjs-form-${window.crypto.randomUUID()}`;
    this.referer = window.location.origin;
    this.formTarget = config.formTarget ?? 'body';
    this.formProperties = { height: '1px' };
    this.sessionId = null;
    this.checkoutPaymentMethods = [];
    this.checkoutFired = false;
    this.connectionManager = new ConnectionManager();
    this.eventHandler = new OpenPayFormEventHandler(this);
    this.ojsVersion = __APP_VERSION__;

    window.addEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  }

  /**
   * Assign the instance to the window as a singleton
   * @param form - The OpenPayForm instance
   */
  static assignAsSingleton(form: OpenPayForm) {
    if (OpenPayForm.getInstance()) {
      throw new Error('OpenPay instance already exists. Only one instance is allowed.');
    }
    // @ts-expect-error window typing
    window['_op_form'] = form;
  }

  /**
   * Get the singleton instance of OpenPayForm
   * @returns The OpenPayForm instance
   */
  static getInstance(): OpenPayForm | null {
    // @ts-expect-error window typing
    return window['_op_form'] ?? null;
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
        // TODO ASAP: do this
        // this.initializePaymentRequests();
      })
      .catch((err) => console.error('[FORM] Error connecting to CDE iframe', err));
  }

  private getFormDiv(): HTMLElement {
    return document.querySelector(this.formTarget) ?? document.body;
  }

  private createOjsFlowContext(): OjsContext {
    if (this.sessionId === null) {
      throw new Error(`Cannot create flow context as sessionId is not available`);
    }
    return {
      formDiv: this.getFormDiv(),
      elementsSessionId: this.sessionId,
      cdeConnections: this.connectionManager.getAllConnections(),
    };
  }

  private getNonCdeFormInputs(): Record<string, unknown> {
    return createInputsDictFromForm(this.getFormDiv());
  }

  private createOjsFlowCallbacks() {
    const noOp = () => {};
    return {
      onCheckoutError: makeCallbackSafe('onCheckoutError', this.config.onCheckoutError ?? noOp),
      onCheckoutStarted: makeCallbackSafe('onCheckoutStarted', this.config.onCheckoutStarted ?? noOp),
      onCheckoutSuccess: makeCallbackSafe('onCheckoutSuccess', this.config.onCheckoutSuccess ?? noOp),
      onSetupPaymentMethodSuccess: makeCallbackSafe(
        'onSetupPaymentMethodSuccess',
        this.config.onSetupPaymentMethodSuccess ?? noOp
      ),
      onValidationError: makeCallbackSafe('onValidationError', this.config.onValidationError ?? noOp),
    };
  }

  submit() {
    OjsFlows.runStripeCcFlow({
      context: this.createOjsFlowContext(),
      checkoutPaymentMethod: findCheckoutPaymentMethodStrict(this.checkoutPaymentMethods, 'credit_card'),
      nonCdeFormInputs: this.getNonCdeFormInputs(),
      flowCallbacks: this.createOjsFlowCallbacks(),
    });
  }

  onPaymentRequestError(errMsg: string): void {
    console.error('[form] Error from payment request:', errMsg);
    this.checkoutFired = false;
    if (this.config.onCheckoutError) this.config.onCheckoutError(errMsg);
  }

  destroy() {
    for (const element of Object.values(this.elements ?? {})) {
      element.node.remove();
    }
    window.removeEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  }
}
