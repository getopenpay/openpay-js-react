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
} from '@getopenpay/utils';
import { OpenPayForm } from './index';

export class OpenPayFormEventHandler {
  formInstance: OpenPayForm;
  nonces: Set<string>;
  formId: string;
  eventTargets: Record<string, MessageEventSource>;
  tokenizedData: SubmitEventPayload | null;
  config: OpenPayForm['config'];
  tokenized: number;

  constructor(formInstance: OpenPayForm) {
    this.formInstance = formInstance;
    this.config = formInstance.config;
    this.formId = formInstance.formId;
    this.eventTargets = {};
    this.nonces = new Set();
    this.tokenizedData = null;
    this.tokenized = 0;
  }

  setExtraData(data: SubmitEventPayload): void {
    this.tokenizedData = data;
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
    console.log('[form] XXX Tokenization started');
    if (this.formInstance.config.onCheckoutStarted) this.formInstance.config.onCheckoutStarted();
  }

  private async handlePaymentFlowStartedEvent(
    payload: PaymentFlowStartedEventPayload,
    eventSource: MessageEventSource,
    elementId: string
  ): Promise<void> {
    console.log('[form] handlePaymentFlowStartedEvent', this.tokenizedData);
    if (!this.tokenizedData) {
      throw new Error(`tokenizedData not populated`);
    }
    const cdeConn = this.formInstance.connectionManager.getConnection();

    const confirmPaymentFlow = async (): Promise<{ proceedToCheckout: boolean }> => {
      const nextActionType = payload.nextActionMetadata['type'];
      console.log('[form] Confirm payment flow: next actions:', payload.nextActionMetadata);
      if (nextActionType === undefined) {
        console.log('[form] Confirming payment flow (No-op)');
      } else if (nextActionType === 'stripe_3ds') {
        console.log('[form] Confirming payment flow (Stripe 3DS');
        await confirmPaymentFlowFor3DS(payload);
      } else if (nextActionType === 'stripe_payment_request') {
        if (!this.formInstance.stripePm) {
          throw new Error(`Stripe PM not set`);
        }
        console.log('[form] Confirming payment flow (Stripe PR)');
        await confirmPaymentFlowForStripePR(payload, this.formInstance.stripePm);
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
        console.log('[form] PF setup payment method complete:', payment_methods);
        this.formInstance.preventClose = false;
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
      console.log('[form] Starting checkout from payment flow.');

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
      console.log('[form] Confirmation payment flow error');
      console.error(e);
      const errMsg = getErrorMessage(e);
      this.formInstance.preventClose = false;
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

    console.log('[form] Tokenized data:', this.tokenizedData, 'allTokenized:', allTokenized);
    if (!this.formInstance.checkoutFired && (allTokenized || payload.isReadyForCheckout)) {
      this.tokenizedData.type =
        this.tokenizedData.type === EventType.enum.TOKENIZE
          ? EventType.enum.CHECKOUT
          : EventType.enum.START_PAYMENT_FLOW;
      console.log('[form] Tokenized card is ready for checkout');
      this.postEventToFrame(source, elementId, this.tokenizedData as EventPayload);
      this.tokenizedData = null;
      console.log('[form] Tokenized data set to null');
    } else {
      console.log('[form] Tokenized data not ready for checkout or checkout already fired');
      this.tokenized = totalTokenized;
    }
  }

  handleCheckoutSuccessEvent(payload: CheckoutSuccessEventPayload) {
    console.log('[form] Checkout complete:', payload);
    if (this.formInstance.config.onCheckoutSuccess) {
      this.formInstance.config.onCheckoutSuccess(payload.invoiceUrls, payload.subscriptionIds, payload.customerId);
    }
  }

  handleSetupPaymentMethodSuccessEvent(payload: SetupCheckoutSuccessEventPayload) {
    console.log('[form] Setup payment method complete:', payload);
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
    if (payload.message === '3DS_REQUIRED') {
      // Handle 3DS_REQUIRED case
      const cardCpm = this.formInstance.checkoutPaymentMethods?.find((cpm) => cpm.provider === 'credit_card');
      if (!this.formInstance.sessionId || !this.formInstance.formTarget || !this.config.onValidationError || !cardCpm)
        return;

      // Try all iframe targets, note that this loop will break as soon as one succeeds
      for (const [elementId, target] of Object.entries(this.eventTargets)) {
        if (!target) continue;
        const startPaymentFlowEvent = constructSubmitEventPayload(
          EventType.enum.START_PAYMENT_FLOW,
          this.formInstance.sessionId,
          document.querySelector(this.formInstance.formTarget) ?? document.body,
          this.config.onValidationError,
          // Only stripe supports frontend 3DS right now,
          // so we pass processor_name: 'stripe' to tell delegator to only use stripe
          { ...cardCpm, processor_name: 'stripe' },
          false
        );
        console.log('[form] startPaymentFlowEvent before setting tokenizedData', JSON.stringify(startPaymentFlowEvent));
        if (!startPaymentFlowEvent) continue;
        this.formInstance.checkoutFired = true;
        // this.setExtraData(startPaymentFlowEvent);
        this.tokenizedData = startPaymentFlowEvent;
        console.log(
          '[form] startPaymentFlowEvent after setting tokenizedData',
          JSON.stringify(startPaymentFlowEvent),
          'tokenizedData',
          JSON.stringify(this.tokenizedData)
        );
        this.postEventToFrame(target, elementId, startPaymentFlowEvent);
        // If first one succeeds, break
        break;
      }
    } else {
      this.formInstance.preventClose = false;
      this.formInstance.checkoutFired = false;
      if (this.formInstance.config.onCheckoutError) this.formInstance.config.onCheckoutError(payload.message);
    }
  }

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

  postEventToFrame(source: MessageEventSource, elementId: string, data: EventPayload) {
    // Implement event emission logic here
    console.log(`Emitting event to ${elementId}:`, data);
    emitEvent(source, this.formId, elementId, data, this.config.baseUrl!);
  }
}
