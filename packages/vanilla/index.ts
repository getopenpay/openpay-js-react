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
  OjsInitFlowsPublishers,
  PR_LOADING,
  PR_ERROR,
  PaymentRequestStartParams,
  LoadedEventPayload,
  ElementTypeEnumValue,
  FRAME_BASE_URL,
  ElementTypeEnum,
  PaymentRequestProvider,
  CdeConnection,
  createInitFlowsPublishers,
  startAllInitFlows,
  getErrorMessage,
} from '@getopenpay/utils';
import { OpenPayFormEventHandler } from './event';
import { ConnectionManager, createConnection } from './utils/connection';
import { InitStripePrFlowResult, InitStripePrFlowSuccess } from '@getopenpay/utils/src/flows/stripe/stripe-pr-flow';
import { Loadable } from '@getopenpay/utils/src/flows/common/common-flow-utils';
import { createOjsFlowLoggers, CustomInitParams } from '@getopenpay/utils/src/flows/ojs-flow';
import { FormCallbacks, parseFormCallbacks } from '@getopenpay/utils/src/form-callbacks';
import { LoadedOncePublisher } from '@getopenpay/utils/src/loaded-once-publisher';
export { FieldName };

export type ElementsFormProps = {
  className?: string;
  checkoutSecureToken: string;
  baseUrl?: string;
  formTarget?: string;
  customInitParams?: CustomInitParams;
  separateFrames?: boolean;
};

export type Config = ElementsFormProps & FormCallbacks;
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

  // Subjects
  private cdeLoadEvent: LoadedOncePublisher<LoadedEventPayload>;
  private anyCdeConn: LoadedOncePublisher<CdeConnection>;
  readonly initFlowsPublishers: OjsInitFlowsPublishers;

  constructor(config: Config) {
    OpenPayForm.assignAsSingleton(this);
    this.ojsVersion = __APP_VERSION__;
    this.ojsReleaseVersion = __RELEASE_VERSION__;
    this.baseUrl = config.baseUrl ?? 'https://cde.getopenpay.com';
    this.config = { ...config, baseUrl: this.baseUrl };
    this.formCallbacks = parseFormCallbacks(config);
    this.registeredElements = null;
    this.formId = `opjs-form-${window.crypto.randomUUID()}`;
    this.referrer = window.location.origin;
    this.formTarget = config.formTarget ?? 'body';
    this.formProperties = { height: '1px' };
    this.connectionManager = new ConnectionManager();

    // Subjects
    this.cdeLoadEvent = new LoadedOncePublisher<LoadedEventPayload>();
    this.anyCdeConn = new LoadedOncePublisher<CdeConnection>();
    this.initFlowsPublishers = createInitFlowsPublishers();

    // Event handlers
    this.eventHandler = new OpenPayFormEventHandler(this.formId, this.baseUrl, this.formCallbacks, {
      setFormHeight: this.setFormHeight,
      onCdeLoaded: this.onCdeLoaded,
    });
    window.addEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));

    // Start async initialization of the form
    this.startFormInit();
  }

  private startFormInit = async () => {
    try {
      log__('Initializing OpenPay form:');

      log__('├ Waiting for CDE load event...');
      const cdeLoaded = await this.cdeLoadEvent.waitForLoad({
        ms: 120_000,
        errMsg: GENERIC_CONN_ERR,
      });
      log__('├ CDE load event received');

      log__('├ Waiting for CDE connection...');
      const anyCdeConn: CdeConnection = await this.anyCdeConn.waitForLoad({
        ms: 120_000,
        errMsg: GENERIC_CONN_ERR,
      });
      log__('├ CDE connection received');

      log__('├ Starting OJS init flows...');
      const ojsContext: OjsContext = OpenPayForm.buildOjsFlowContext(
        this.config,
        cdeLoaded,
        anyCdeConn,
        this.getFormDiv()
      );
      await startAllInitFlows(this.initFlowsPublishers, ojsContext, this.createOjsFlowCallbacks());
      log__('╰ Done initializing OJS flows.');
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      err__('╰ Error initializing OP form:', errorMessage);
      this.formCallbacks.onLoadError?.(errorMessage);
    }
  };

  /**
   * Assign the instance to the window as a singleton
   * @param form - The OpenPayForm instance
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
   * @returns The OpenPayForm instance
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
    if (this.cdeLoadEvent.current.isSuccess) {
      // Already loaded
      return;
    }
    this.cdeLoadEvent.set(payload);
  };

  // TODO: refactor later
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

  createElement = (elementValue: ElementTypeEnumValue, options: ElementProps = {}) => {
    if (!this.config) throw new Error('OpenPay form not initialized');
    const type = ElementType.parse(elementValue);

    const frame = document.createElement('iframe');
    const queryString = this.buildQueryString(options);

    frame.name = `${type}-element`;
    const url = new URL(`/app/v1/${frame.name}`, this.config.baseUrl);
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
      .catch((err) => console.error('[FORM] Error connecting to CDE iframe', err));
  };

  private getFormDiv = (): HTMLElement => {
    return document.querySelector(this.formTarget) ?? document.body;
  };

  private createOjsFlowContext = (): OjsContext => {
    const cdeConnections = this.connectionManager.getAllConnections();
    const cdeLoadedPayload = this.cdeLoadEvent.current.isSuccess ? this.cdeLoadEvent.current.loadedValue : null;
    if (!cdeLoadedPayload) {
      throw new Error('Requested context while CDE not yet loaded');
    }
    if (cdeConnections.size === 0) {
      throw new Error('No CDE connections found');
    }
    const anyCdeConnection = cdeConnections.values().next().value;
    return OpenPayForm.buildOjsFlowContext(this.config, cdeLoadedPayload, anyCdeConnection, this.getFormDiv());
  };

  // Like createOjsFlowContext, but pure
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

  // TODO: convert to stateless
  private createOjsFlowCallbacks = () => {
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
  };

  submitCard = () => {
    const context = this.createOjsFlowContext();
    OjsFlows.commonCC.run({
      context,
      checkoutPaymentMethod: findCheckoutPaymentMethodStrict(context.checkoutPaymentMethods, 'credit_card'),
      nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
      flowCallbacks: this.createOjsFlowCallbacks(),
      customParams: {
        currentCdeConnections: this.connectionManager.getAllConnections(),
      },
      initResult: undefined, // This flow requires no initialization
    });
  };

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

  onPaymentRequestError = (errMsg: string) => {
    console.error('[form] Error from payment request:', errMsg);
    if (this.formCallbacks.onCheckoutError) this.formCallbacks.onCheckoutError(errMsg);
  };

  destroy = () => {
    for (const element of Object.values(this.registeredElements ?? {})) {
      if (!element) continue;
      element.node.remove();
    }
    window.removeEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  };
}
