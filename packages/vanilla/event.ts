import {
  CheckoutSuccessEventPayload,
  constructSubmitEventPayload,
  ElementEvent,
  emitEvent,
  ErrorEventPayload,
  EventPayload,
  EventType,
  LayoutEventPayload,
  LoadedEventPayload,
  parseEventPayload,
  PaymentFlowStartedEventPayload,
  SetupCheckoutSuccessEventPayload,
  ValidationErrorEventPayload,
} from '@getopenpay/utils';
import { OpenPayForm } from './index';

export class OpenPayFormEventHandler {
  formInstance: OpenPayForm;
  nonces: Set<string>;
  formId: string;
  eventTargets: Record<string, MessageEventSource>;
  extraData: object | null;
  config: OpenPayForm['config'];
  checkoutFired: boolean;
  tokenized: number;
  tokenizedData: object | null;

  constructor(formInstance: OpenPayForm) {
    this.formInstance = formInstance;
    this.config = formInstance.config;
    this.formId = formInstance.formId;
    this.eventTargets = {};
    this.nonces = new Set();
    this.extraData = null;
    this.checkoutFired = false;
    this.tokenizedData = null;
    this.tokenized = 0;
  }

  handleMessage(event: MessageEvent) {
    if (event.origin !== this.formInstance.config.baseUrl || !event.source) return;

    const eventData = parseEventPayload(JSON.parse(event.data));
    const isValid = this.validateEvent(eventData);
    if (!isValid) return;

    const { elementId, payload } = eventData;
    const eventType = payload.type;

    console.log(`[form] Received ${eventType} event from ${elementId}:`, payload);

    switch (eventType) {
      case 'LAYOUT':
        this.handleLayoutEvent(payload);
        break;
      case 'FOCUS':
        this.handleFocusEvent(elementId);
        break;
      case 'BLUR':
        this.handleBlurEvent(elementId);
        break;
      case 'CHANGE':
        this.handleChangeEvent(elementId);
        break;
      case 'LOADED':
        this.handleLoadedEvent(event.source, elementId, payload);
        break;
      case 'TOKENIZE_STARTED':
        this.handleTokenizeStartedEvent();
        break;
      case 'PAYMENT_FLOW_STARTED':
        this.handlePaymentFlowStartedEvent(payload);
        break;
      case 'TOKENIZE_SUCCESS':
        this.handleTokenizeSuccessEvent(event.source, elementId);
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
    this.formInstance.formProperties.height = height;
    console.log(`[form] Element height set to: ${height}`);
  }

  handleFocusEvent(elementId: string) {
    if (this.config.onFocus) this.config.onFocus(elementId);
  }

  handleBlurEvent(elementId: string) {
    if (this.config.onBlur) this.config.onBlur(elementId);
  }

  handleChangeEvent(elementId: string) {
    if (this.config.onChange) this.config.onChange(elementId);
  }

  handleLoadedEvent(source: MessageEventSource, elementId: string, payload: LoadedEventPayload) {
    this.eventTargets[elementId] = source;
    if (!this.formInstance.sessionId) {
      this.formInstance.sessionId = payload.sessionId;
    }
    if (this.config.onLoad) {
      this.config.onLoad(payload.totalAmountAtoms, payload.currency);
    }
    this.formInstance.checkoutPaymentMethods = payload.checkoutPaymentMethods;
    console.log(`[form] Element loaded with prefill data:`, payload);
  }

  handleTokenizeStartedEvent() {
    console.log('[form] Tokenization started');
    // TODO: Implement logic to prevent form close
    // this.formInstance.setPreventClose(true);
    if (this.formInstance.config.onCheckoutStarted) this.formInstance.config.onCheckoutStarted();
  }

  handlePaymentFlowStartedEvent(payload: PaymentFlowStartedEventPayload) {
    // Implement payment flow logic here
    console.log('[form] Payment flow started:', payload);
  }

  handleTokenizeSuccessEvent(source: MessageEventSource, elementId: string) {
    const totalTokenized = this.tokenized + 1;
    const allTokenized = totalTokenized === Object.keys(this.eventTargets).length;

    if (!this.checkoutFired && this.tokenizedData && allTokenized) {
      console.log('[form] Tokenized card is ready for checkout');
      this.emitEvent(source, elementId, this.tokenizedData as EventPayload);
      this.checkoutFired = true;
      this.tokenizedData = null;
    } else {
      this.tokenized = totalTokenized;
    }
  }

  handleCheckoutSuccessEvent(payload: CheckoutSuccessEventPayload) {
    console.log('[form] Checkout complete:', payload);
    // this.formInstance.setPreventClose(false);
    // this.checkoutFired = false;
    if (this.formInstance.config.onCheckoutSuccess) {
      this.formInstance.config.onCheckoutSuccess(payload.invoiceUrls, payload.subscriptionIds, payload.customerId);
    }
  }

  handleSetupPaymentMethodSuccessEvent(payload: SetupCheckoutSuccessEventPayload) {
    console.log('[form] Setup payment method complete:', payload);
    // this.formInstance.setPreventClose(false);
    // this.checkoutFired = false;
    if (this.formInstance.config.onSetupPaymentMethodSuccess) {
      this.formInstance.config.onSetupPaymentMethodSuccess(payload.paymentMethodId);
    }
  }

  handleLoadErrorEvent(payload: ErrorEventPayload) {
    console.error('[form] Error loading iframe:', payload.message);
    if (this.formInstance.config.onLoadError) this.formInstance.config.onLoadError(payload.message);
  }

  handleValidationErrorEvent(payload: ValidationErrorEventPayload, elementId: string) {
    console.error(`[form] Validation error for ${payload.elementType}:`, payload.errors);
    if (this.formInstance.config.onValidationError) {
      this.formInstance.config.onValidationError(payload.elementType, payload.errors, elementId);
    }
  }

  handleErrorEvent(payload: ErrorEventPayload) {
    console.error('[form] API error from element:', payload.message);
    // this.formInstance.setPreventClose(false);
    // this.checkoutFired = false;
    if (this.formInstance.config.onCheckoutError) this.formInstance.config.onCheckoutError(payload.message);
  }

  handleFormSubmit() {
    if (
      !this.formInstance.sessionId ||
      !this.formInstance.checkoutPaymentMethods?.length ||
      !this.config.onValidationError
    )
      return;
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
      this.emitEvent(target, elementId, tokenizeData);
    }
    this.tokenizedData = tokenizeData;
  }

  emitEvent(source: MessageEventSource, elementId: string, data: EventPayload) {
    // Implement event emission logic here
    console.log(`Emitting event to ${elementId}:`, data);
    emitEvent(source, this.formId, elementId, data, this.config.baseUrl!);
  }
}
