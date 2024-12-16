import {
  convertStylesToQueryString,
  createInputsDictFromForm,
  ElementProps,
  ElementType,
  FieldName,
  findCheckoutPaymentMethodStrict,
  OjsContext,
  OjsFlows,
  LoadedEventPayload,
  ElementTypeEnumValue,
  FRAME_BASE_URL,
  ElementTypeEnum,
  CdeConnection,
  createInitFlowsPublishers,
  startAllInitFlows,
  getErrorMessage,
} from '@getopenpay/utils';
import { OpenPayFormEventHandler } from './event';
import { ConnectionManager, createConnection } from './utils/connection';
import { createOjsFlowLoggers, CustomInitParams } from '@getopenpay/utils/src/flows/ojs-flow';
import { AllCallbacks, FormCallbacks } from '@getopenpay/utils/src/form-callbacks';
import { LoadedOncePublisher } from '@getopenpay/utils/src/loaded-once-publisher';
import { setupPaymentRequestHandlers } from './utils/payment-request';
export { FieldName };

export type ElementsFormProps = {
  className?: string;
  checkoutSecureToken: string;
  baseUrl?: string;
  formTarget?: string;
  customInitParams?: CustomInitParams;
};

export type Config = ElementsFormProps & AllCallbacks;
type RegisteredElement = { type: ElementType; node: HTMLIFrameElement; mount: (selector: string) => void };

const GENERIC_CONN_ERR = `The secure form failed to load properly. Please check your internet connection, or try again later.`;
const { log__, err__ } = createOjsFlowLoggers('op-form');

export class OpenPayForm {
  // Static properties (however the object's props are not guaranteed to be immutable)
  readonly config: Config;
  readonly formId: string;
  readonly formTarget: string;
  readonly ojsVersion: string;
  readonly ojsReleaseVersion: string;
  readonly formProperties: { height: string };
  readonly referrer: string;
  readonly baseUrl: string;
  readonly formCallbacks: FormCallbacks;

  // Mutable properties
  private registeredElements: Record<ElementType, RegisteredElement | undefined> | null;

  // Helpers
  private eventHandler: OpenPayFormEventHandler;
  private connectionManager: ConnectionManager;

  // For easier debugging
  static ojsFlows: typeof OjsFlows = OjsFlows;

  // Publishers
  private readonly cdeLoadEvent = new LoadedOncePublisher<LoadedEventPayload>();
  private readonly anyCdeConn = new LoadedOncePublisher<CdeConnection>();
  private readonly context = new LoadedOncePublisher<OjsContext>();
  readonly initFlows = createInitFlowsPublishers();

  constructor(config: Config) {
    OpenPayForm.assignAsSingleton(this);
    this.ojsVersion = __APP_VERSION__;
    this.ojsReleaseVersion = __RELEASE_VERSION__;
    this.baseUrl = config.baseUrl ?? 'https://cde.getopenpay.com';
    this.config = { ...config, baseUrl: this.baseUrl };
    this.formCallbacks = FormCallbacks.fromObject(config);
    this.registeredElements = null;
    this.formId = `opjs-form-${window.crypto.randomUUID()}`;
    this.referrer = window.location.origin;
    this.formTarget = config.formTarget ?? 'body';
    this.formProperties = { height: '1px' };
    this.connectionManager = new ConnectionManager();

    // Event handlers
    this.eventHandler = new OpenPayFormEventHandler(this.formId, this.baseUrl, this.formCallbacks, {
      setFormHeight: this.setFormHeight,
      onCdeLoaded: this.onCdeLoaded,
      onCdeLoadError: this.onCdeLoadError,
    });
    window.addEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));

    // Start async initialization of the form
    this.startFormInit();
  }

  /**
   * Starts the form initialization process
   */
  private startFormInit = async () => {
    try {
      log__('Initializing OpenPay form:');

      log__('├ Waiting for CDE load event...');
      const cdeLoaded = await this.cdeLoadEvent.waitForLoad({
        timeoutSec: 120,
        timeoutErrMsg: GENERIC_CONN_ERR,
      });
      log__('├ CDE load event received');

      log__('├ Waiting for CDE connection...');
      const anyCdeConn: CdeConnection = await this.anyCdeConn.waitForLoad({
        timeoutSec: 120,
        timeoutErrMsg: GENERIC_CONN_ERR,
      });
      log__('├ CDE connection received');

      log__('├ Creating OJS context, setting up handlers...');
      const ojsContext: OjsContext = OpenPayForm.buildOjsFlowContext(
        this.config,
        cdeLoaded,
        anyCdeConn,
        this.getFormDiv()
      );
      this.context.set(ojsContext);
      setupPaymentRequestHandlers(this.initFlows, ojsContext, this.formCallbacks);

      log__('├ Starting OJS init flows...');
      await startAllInitFlows(this.initFlows, ojsContext, this.formCallbacks);
      this.formCallbacks.get.onLoad?.(cdeLoaded.totalAmountAtoms, cdeLoaded.currency);
      log__('╰ Done initializing OJS flows.');
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      err__('╰ Error initializing OP form:', errorMessage);
      // Note: normally you don't need this, but it's good for visibility
      // There might be a case where onLoad is called, then onLoadError is called next
      this.formCallbacks.get.onLoadError?.(errorMessage);
    }
  };

  /**
   * Assign the instance to the window as a singleton
   */
  private static assignAsSingleton = (form: OpenPayForm) => {
    if (OpenPayForm.getInstance()) {
      throw new Error('OpenPay instance already exists. Only one instance is allowed.');
    }
    // @ts-expect-error window typing
    window['ojs'] = form;
  };

  /**
   * Get the singleton instance of OpenPayForm
   */
  static getInstance = (): OpenPayForm | null => {
    // @ts-expect-error window typing
    return window['ojs'] ?? null;
  };

  public get checkoutSecureToken() {
    return this.config.checkoutSecureToken;
  }

  public setFormHeight = (height: string) => {
    this.formProperties.height = height;
    if (this.registeredElements) {
      Object.values(this.registeredElements).forEach((element) => {
        if (!element) return;
        element.node.style.height = height;
      });
    }
  };

  onCdeLoaded = (payload: LoadedEventPayload) => {
    if (!this.cdeLoadEvent.current.isSuccess) {
      this.cdeLoadEvent.set(payload);
    }
  };

  onCdeLoadError = (errMsg: string) => {
    if (!this.cdeLoadEvent.current.isSuccess) {
      this.cdeLoadEvent.throw(new Error(errMsg), errMsg);
    }
  };

  createElement = (elementValue: ElementTypeEnumValue, options: ElementProps = {}) => {
    if (!this.config) throw new Error('OpenPay form not initialized');
    const type = ElementType.parse(elementValue);

    const frame = document.createElement('iframe');
    const queryString = this.buildQueryString(options);

    frame.name = `${type}-element`;
    const url = new URL(`/app/v1/${frame.name}/`, this.config.baseUrl);
    url.search = queryString.toString();
    frame.src = url.href;
    frame.style.border = 'none';
    frame.style.width = '100%';

    const registeredElement = this.registerIframe(type, frame);
    return registeredElement;
  };

  registerIframe = (type: ElementTypeEnum, frame: HTMLIFrameElement): RegisteredElement => {
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
  };

  private buildQueryString = (options: ElementProps): URLSearchParams => {
    const queryString = new URLSearchParams();
    queryString.append('referer', this.referrer);
    queryString.append('formId', this.formId);
    if (options.styles) {
      queryString.append('styles', convertStylesToQueryString(options.styles));
    }
    queryString.append('secureToken', this.config.checkoutSecureToken);
    return queryString;
  };

  private connectToElement = (element: { type: ElementType; node: HTMLIFrameElement }) => {
    createConnection(element.node)
      .then((conn) => {
        this.connectionManager.addConnection(element.type, conn);
        if (!this.anyCdeConn.current.isSuccess) {
          this.anyCdeConn.set(conn);
        }
      })
      .catch((err) => err__('[FORM] Error connecting to CDE iframe', err));
  };

  private getFormDiv = (): HTMLElement => {
    return document.querySelector(this.formTarget) ?? document.body;
  };

  /**
   * Builds the OJS context object. Take note that this is a pure function.
   */
  private static buildOjsFlowContext = (
    config: Config,
    cdeLoadedPayload: LoadedEventPayload,
    anyCdeConnection: CdeConnection,
    formDiv: HTMLElement
  ) => {
    return {
      baseUrl: new URL(config.baseUrl ?? FRAME_BASE_URL).origin,
      formDiv,
      elementsSessionId: cdeLoadedPayload.sessionId,
      checkoutPaymentMethods: cdeLoadedPayload.checkoutPaymentMethods,
      anyCdeConnection,
      customInitParams: config.customInitParams ?? {},
    };
  };

  /**
   * Runs the common credit card flow
   */
  submitCard = () => {
    const context = this.context.getValueIfLoadedElse(null);
    if (!context) {
      err__('Please wait for the form to finish loading before submitting.');
      return;
    }
    OjsFlows.commonCC.run({
      context,
      checkoutPaymentMethod: findCheckoutPaymentMethodStrict(context.checkoutPaymentMethods, 'credit_card'),
      nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
      formCallbacks: this.formCallbacks,
      customParams: {
        currentCdeConnections: this.connectionManager.getAllConnections(),
      },
      initResult: undefined, // This flow requires no initialization
    });
  };

  /**
   * Alias for submitCard
   */
  submit = this.submitCard;

  destroy = () => {
    for (const element of Object.values(this.registeredElements ?? {})) {
      if (!element) continue;
      element.node.remove();
    }
    window.removeEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  };
}
