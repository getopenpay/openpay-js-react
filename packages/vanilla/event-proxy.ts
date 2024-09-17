class OpenPayFormEventHandler {
    constructor(formInstance, config) {
      this.formInstance = formInstance;
      this.config = config;
      this.frameBaseUrl = config.frameBaseUrl;
      this.formId = config.formId;
      this.eventTargets = {};
      this.nonces = new Set();
      this.checkoutFired = false;
      this.extraData = null;
    }
  
    handleMessage(event) {
      if (event.origin !== this.frameBaseUrl || !event.source) return;
  
      const eventData = this.parseEventPayload(JSON.parse(event.data));
      if (!this.validateEvent(eventData)) return;
  
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
  
    parseEventPayload(data) {
      // Implement parsing logic here
      return data;
    }
  
    validateEvent(eventData) {
      if (eventData.formId !== this.formId || !eventData.elementId) {
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
  
    handleLayoutEvent(payload) {
      const height = payload.height ? `${payload.height}px` : '100%';
      this.formInstance.setFormHeight(height);
      console.log(`[form] Element height set to: ${height}`);
    }
  
    handleFocusEvent(elementId) {
      if (this.config.onFocus) this.config.onFocus(elementId);
    }
  
    handleBlurEvent(elementId) {
      if (this.config.onBlur) this.config.onBlur(elementId);
    }
  
    handleChangeEvent(elementId) {
      if (this.config.onChange) this.config.onChange(elementId);
    }
  
    handleLoadedEvent(source, elementId, payload) {
      this.eventTargets[elementId] = source;
      this.formInstance.setTotalAmountAtoms(payload.totalAmountAtoms);
      this.formInstance.setCurrency(payload.currency);
      this.formInstance.setCheckoutPaymentMethods(payload.checkoutPaymentMethods);
      if (!this.formInstance.sessionId) this.formInstance.setSessionId(payload.sessionId);
      console.log(`[form] Element loaded with prefill data:`, payload);
    }
  
    handleTokenizeStartedEvent() {
      console.log('[form] Tokenization started');
      this.formInstance.setPreventClose(true);
      if (this.config.onCheckoutStarted) this.config.onCheckoutStarted();
    }
  
    handlePaymentFlowStartedEvent(payload) {
      // Implement payment flow logic here
      console.log('[form] Payment flow started:', payload);
    }
  
    handleTokenizeSuccessEvent(source, elementId) {
      if (!this.checkoutFired && this.extraData) {
        console.log('[form] Tokenized card is ready for checkout');
        this.emitEvent(source, elementId, this.extraData);
        this.checkoutFired = true;
        this.extraData = null;
      }
    }
  
    handleCheckoutSuccessEvent(payload) {
      console.log('[form] Checkout complete:', payload);
      this.formInstance.setPreventClose(false);
      this.checkoutFired = false;
      if (this.config.onCheckoutSuccess) {
        this.config.onCheckoutSuccess(payload.invoiceUrls, payload.subscriptionIds, payload.customerId);
      }
    }
  
    handleSetupPaymentMethodSuccessEvent(payload) {
      console.log('[form] Setup payment method complete:', payload);
      this.formInstance.setPreventClose(false);
      this.checkoutFired = false;
      if (this.config.onSetupPaymentMethodSuccess) {
        this.config.onSetupPaymentMethodSuccess(payload.paymentMethodId);
      }
    }
  
    handleLoadErrorEvent(payload) {
      console.error('[form] Error loading iframe:', payload.message);
      if (this.config.onLoadError) this.config.onLoadError(payload.message);
    }
  
    handleValidationErrorEvent(payload, elementId) {
      console.error(`[form] Validation error for ${payload.elementType}:`, payload.errors);
      if (this.config.onValidationError) {
        this.config.onValidationError(payload.elementType, payload.errors, elementId);
      }
    }
  
    handleErrorEvent(payload) {
      console.error('[form] API error from element:', payload.message);
      this.formInstance.setPreventClose(false);
      this.checkoutFired = false;
      if (this.config.onCheckoutError) this.config.onCheckoutError(payload.message);
    }
  
    emitEvent(source, elementId, data) {
      // Implement event emission logic here
      console.log(`Emitting event to ${elementId}:`, data);
    }
  }
  
  // Usage with OpenPayForm
  OpenPayForm.prototype.initEventHandler = function(config) {
    this.eventHandler = new OpenPayFormEventHandler(this, config);
    window.addEventListener('message', this.eventHandler.handleMessage.bind(this.eventHandler));
  };
  
  // Add to OpenPayForm constructor
  constructor(config) {
    // ... existing code ...
    this.initEventHandler(config);
  }
  
