import {
  CheckoutSuccessEventPayload,
  confirmPaymentFlowFor3DS,
  confirmPaymentFlowForStripePR,
  constructSubmitEventPayload,
  ElementEvent,
  emitEvent,
  ErrorEventPayload,
  EventPayload,
  EventType,
  getPrefill,
  LayoutEventPayload,
  LoadedEventPayload,
  parseEventPayload,
  PaymentFlowStartedEventPayload,
  SetupCheckoutSuccessEventPayload,
  SubmitEventPayload,
  ValidationErrorEventPayload,
  confirmPaymentFlow as confirmPaymentFlowInCDE,
  getErrorMessage,
  TokenizeSuccessEventPayload,
  AllFieldNames,
  CheckoutPaymentMethod,
} from '@getopenpay/utils';
import { OpenPayForm } from './index';
import { ConnectionManager } from './utils/connection';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';

export class OpenPayFormEventHandler {
  formInstance: OpenPayForm;
  eventTargets: Record<string, MessageEventSource>;
  private nonces: Set<string>;
  private formId: string;
  private tokenizedData: SubmitEventPayload | null;
  private config: OpenPayForm['config'];
  private tokenized: number;
  private connectionManager: ConnectionManager;
  private stripePm: PaymentRequestPaymentMethodEvent | undefined;

  constructor(formInstance: OpenPayForm) {
    this.formInstance = formInstance;
    this.config = formInstance.config;
    this.formId = formInstance.formId;
    this.eventTargets = {};
    this.nonces = new Set();
    this.tokenizedData = null;
    this.tokenized = 0;
    this.connectionManager = formInstance.getConnectionManager();
  }

  setTokenizedData(data: SubmitEventPayload): void {
    this.tokenizedData = data;
  }

  handleMessage(event: MessageEvent) {
    if (!event.source) {
      throw new Error(`No source found`);
    }
    if (event.origin !== this.formInstance.config._frameUrl?.origin) {
      // Skipping if origin does not match
      return;
    }

    const eventData = parseEventPayload(JSON.parse(event.data));
    const isValid = this.validateEvent(eventData);
    if (!isValid) return;

    const { elementId, payload } = eventData;
    const eventType = payload.type;

    switch (eventType) {
      case 'LAYOUT':
        this.handleLayoutEvent(payload);
        break;
      case 'FOCUS':
        this.handleFocusEvent(elementId, payload.elementType);
        break;
      case 'BLUR':
        this.handleBlurEvent(elementId, payload.elementType);
        break;
      case 'CHANGE':
        this.handleChangeEvent(elementId, payload.elementType, payload.errors);
        break;
      case 'LOADED':
        this.handleLoadedEvent(event.source, elementId, payload);
        break;
      case 'TOKENIZE_STARTED':
        // TODO: reconsider this event
        // this.handleTokenizeStartedEvent();
        break;
      case 'CHECKOUT_STARTED':
        // TODO: reconsider this event
        this.handleCheckoutStartedEvent();
        break;
      case 'PAYMENT_FLOW_STARTED':
        this.handlePaymentFlowStartedEvent(payload, event.source as MessageEventSource, elementId);
        break;
      case 'TOKENIZE_SUCCESS':
        this.handleTokenizeSuccessEvent(event.source, elementId, payload);
        break;
      case 'CHECKOUT_SUCCESS':
        this.handleCheckoutSuccessEvent(payload);
        break;
      case 'SETUP_PAYMENT_METHOD_SUCCESS':
        this.handleSetupPaymentMethodSuccessEvent(payload);
        break;
      case 'LOAD_ERROR':
        this.handleLoadErrorEvent(payload);
        break;
      case 'VALIDATION_ERROR':
        this.handleValidationErrorEvent(payload, elementId);
        break;
      case 'TOKENIZE_ERROR':
      case 'CHECKOUT_ERROR':
        this.handleErrorEvent(payload);
        break;
      default:
        console.warn('[form] Unhandled event type:', eventType);
    }
  }

  validateEvent(eventData: ElementEvent) {
    if (eventData.formId !== this.formInstance.formId || !eventData.elementId) {
      console.warn('[form] Ignoring unknown event:', eventData);
      return false;
    }

    if (this.nonces.has(eventData.nonce)) {
      console.warn('[form] Ignoring duplicate event:', eventData);
      return false;
    }

    this.nonces.add(eventData.nonce);

    return true;
  }

  handleLayoutEvent(payload: LayoutEventPayload) {
    const height = payload.height ? `${payload.height}px` : '100%';
    this.formInstance.setFormHeight(height);
  }

  handleFocusEvent(elementId: string, field: AllFieldNames) {
    if (this.config.onFocus) this.config.onFocus(elementId, field);
  }

  handleBlurEvent(elementId: string, field: AllFieldNames) {
    if (this.config.onBlur) this.config.onBlur(elementId, field);
  }

  handleChangeEvent(elementId: string, field: AllFieldNames, errors?: string[]) {
    if (this.config.onChange) this.config.onChange(elementId, field, errors);
  }

  handleLoadedEvent(source: MessageEventSource, elementId: string, payload: LoadedEventPayload) {
    this.eventTargets[elementId] = source;
    console.log('handleLoadedEvent XXXXXXXXX', payload);
    if (!this.formInstance.sessionId) {
      this.formInstance.sessionId = payload.sessionId;
    }
    if (this.config.onLoad) {
      this.config.onLoad(payload.totalAmountAtoms, payload.currency);
    }
    this.formInstance.checkoutPaymentMethods = payload.checkoutPaymentMethods;
  }

  handleTokenizeStartedEvent() {
    if (this.formInstance.config.onCheckoutStarted) this.formInstance.config.onCheckoutStarted();
  }
  handleCheckoutStartedEvent() {
    if (this.formInstance.config.onCheckoutStarted) this.formInstance.config.onCheckoutStarted();
  }

  private async handlePaymentFlowStartedEvent(
    payload: PaymentFlowStartedEventPayload,
    eventSource: MessageEventSource,
    elementId: string
  ): Promise<void> {
    if (!this.tokenizedData) {
      throw new Error(`tokenizedData not populated`);
    }
    const cdeConn = this.connectionManager.getConnection();

    const confirmPaymentFlow = async (): Promise<{ proceedToCheckout: boolean }> => {
      const nextActionType = payload.nextActionMetadata['type'];
      if (nextActionType === undefined) {
        // No-op
      } else if (nextActionType === 'stripe_3ds') {
        await confirmPaymentFlowFor3DS(payload);
      } else if (nextActionType === 'stripe_payment_request') {
        if (!this.stripePm) {
          throw new Error(`Stripe PM not set`);
        }
        await confirmPaymentFlowForStripePR(payload, this.stripePm);
      } else {
        throw new Error(`Unknown next action type: ${nextActionType}`);
      }
      const prefill = await getPrefill(cdeConn);
      if (prefill.mode === 'setup') {
        const { payment_methods } = await confirmPaymentFlowInCDE(cdeConn, {
          secure_token: prefill.token,
          existing_cc_pm_id: this.tokenizedData?.existingCCPMId,
        });
        if (payment_methods.length !== 1) {
          throw new Error(`Expected exactly one payment method, got ${payment_methods.length}`);
        }
        this.tokenized = 0;
        this.formInstance.checkoutFired = false;

        if (this.formInstance.config.onSetupPaymentMethodSuccess) {
          this.formInstance.config.onSetupPaymentMethodSuccess(payment_methods[0].id);
        }
        return {
          proceedToCheckout: false,
        };
      } else {
        return {
          proceedToCheckout: true,
        };
      }
    };

    try {
      const { proceedToCheckout } = await confirmPaymentFlow();
      if (!proceedToCheckout) {
        return;
      }

      let existingCCPMId: string | undefined;
      if (this.tokenizedData.checkoutPaymentMethod.provider === 'credit_card') {
        existingCCPMId = payload.startPFMetadata?.cc_pm_id;
        if (!existingCCPMId) {
          throw new Error(`CC PM ID not found`);
        }
      }

      emitEvent(
        eventSource,
        this.formInstance.formId,
        elementId,
        { ...this.tokenizedData, type: 'CHECKOUT', doNotUseLegacyCCFlow: true, existingCCPMId },
        this.formInstance.config.baseUrl!
      );
      this.formInstance.checkoutFired = true;
      this.tokenizedData = null;
      if (this.formInstance.config.onCheckoutStarted) this.formInstance.config.onCheckoutStarted();
    } catch (e) {
      const errMsg = getErrorMessage(e);
      this.formInstance.checkoutFired = false;

      if (this.formInstance.config.onCheckoutError) this.formInstance.config.onCheckoutError(errMsg);
    }
  }

  handleTokenizeSuccessEvent(source: MessageEventSource, elementId: string, payload: TokenizeSuccessEventPayload) {
    if (!this.tokenizedData) {
      throw new Error('Tokenized data not found');
    }
    const totalTokenized = this.tokenized + 1;
    const allTokenized = totalTokenized === Object.keys(this.eventTargets).length;

    if (!this.formInstance.checkoutFired && (allTokenized || payload.isReadyForCheckout)) {
      this.tokenizedData.type =
        this.tokenizedData.type === EventType.enum.TOKENIZE
          ? EventType.enum.CHECKOUT
          : EventType.enum.START_PAYMENT_FLOW;
      this.postEventToFrame(source, elementId, this.tokenizedData as EventPayload);
      this.tokenizedData = null;
    } else {
      this.tokenized = totalTokenized;
    }
  }

  handleCheckoutSuccessEvent(payload: CheckoutSuccessEventPayload) {
    if (this.formInstance.config.onCheckoutSuccess) {
      this.formInstance.config.onCheckoutSuccess(payload.invoiceUrls, payload.subscriptionIds, payload.customerId);
    }
  }

  handleSetupPaymentMethodSuccessEvent(payload: SetupCheckoutSuccessEventPayload) {
    if (this.formInstance.config.onSetupPaymentMethodSuccess) {
      this.formInstance.config.onSetupPaymentMethodSuccess(payload.paymentMethodId);
    }
  }

  handleLoadErrorEvent(payload: ErrorEventPayload) {
    if (this.formInstance.config.onLoadError) this.formInstance.config.onLoadError(payload.message);
  }

  handleValidationErrorEvent(payload: ValidationErrorEventPayload, elementId: string) {
    if (this.formInstance.config.onValidationError) {
      this.formInstance.config.onValidationError(payload.elementType, payload.errors, elementId);
    }
  }

  handleErrorEvent(payload: ErrorEventPayload) {
    if (payload.message === '3DS_REQUIRED') {
      const cardCpm = this.formInstance.checkoutPaymentMethods?.find((cpm) => cpm.provider === 'credit_card');
      if (!this.formInstance.sessionId || !this.formInstance.formTarget || !this.config.onValidationError || !cardCpm)
        return;

      for (const [elementId, target] of Object.entries(this.eventTargets)) {
        if (!target) continue;
        const startPaymentFlowEvent = constructSubmitEventPayload(
          EventType.enum.START_PAYMENT_FLOW,
          this.formInstance.sessionId,
          document.querySelector(this.formInstance.formTarget) ?? document.body,
          this.config.onValidationError,
          { ...cardCpm, processor_name: 'stripe' },
          false
        );
        if (!startPaymentFlowEvent) continue;
        this.formInstance.checkoutFired = true;
        this.tokenizedData = startPaymentFlowEvent;
        this.postEventToFrame(target, elementId, startPaymentFlowEvent);
        break;
      }
    } else {
      this.formInstance.checkoutFired = false;
      if (this.formInstance.config.onCheckoutError) this.formInstance.config.onCheckoutError(payload.message);
    }
  }

  // TODO ASAP: refactor this first
  handleFormSubmit() {
    if (
      !this.formInstance.sessionId ||
      !this.formInstance.checkoutPaymentMethods?.length ||
      !this.config.onValidationError
    ) {
      return;
    }
    const cardCpm = this.formInstance.checkoutPaymentMethods.find((cpm) => cpm.provider === 'credit_card');

    if (!cardCpm) {
      throw new Error('Card not available as a payment method in checkout');
    }

    const tokenizeData = constructSubmitEventPayload(
      EventType.enum.TOKENIZE,
      this.formInstance.sessionId!,
      document.querySelector(this.formInstance.formTarget) ?? document.body,
      this.config.onValidationError,
      cardCpm,
      false
    );
    if (!tokenizeData) {
      throw new Error('Error constructing tokenize data');
    }
    for (const [elementId, target] of Object.entries(this.eventTargets)) {
      if (!target) continue;
      this.postEventToFrame(target, elementId, tokenizeData);
    }
    this.tokenizedData = tokenizeData;
  }

  // TODO ASAP: remove this
  async onUserCompletePaymentRequestUI(
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ): Promise<void> {
    if (!this.config.onValidationError || !this.formInstance.sessionId || !this.formInstance.checkoutPaymentMethods)
      return;

    for (const [elementId, element] of Object.entries(this.eventTargets ?? {})) {
      const paymentFlowMetadata = { stripePmId: stripePm.paymentMethod.id };
      const startPaymentFlowEvent = constructSubmitEventPayload(
        EventType.enum.START_PAYMENT_FLOW,
        this.formInstance.sessionId,
        document.querySelector(this.formInstance.formTarget) ?? document.body,
        this.config.onValidationError,
        checkoutPaymentMethod,
        false,
        paymentFlowMetadata
      );
      if (!startPaymentFlowEvent) continue;
      this.stripePm = stripePm;
      this.formInstance.checkoutFired = true;
      this.setTokenizedData(startPaymentFlowEvent);
      this.postEventToFrame(element, elementId, startPaymentFlowEvent);
      // emitEvent(element.node.contentWindow!, this.formId, elementId, startPaymentFlowEvent, this.config.baseUrl!);
      break;
    }
  }

  postEventToFrame(source: MessageEventSource, elementId: string, data: EventPayload) {
    emitEvent(source, this.formId, elementId, data, this.config.baseUrl!);
  }
}
