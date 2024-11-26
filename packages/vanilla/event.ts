import {
  ElementEvent,
  emitEvent,
  ErrorEventPayload,
  EventPayload,
  LayoutEventPayload,
  LoadedEventPayload,
  parseEventPayload,
  ValidationErrorEventPayload,
  AllFieldNames,
} from '@getopenpay/utils';
import { OpenPayForm } from './index';
// import { ConnectionManager } from './utils/connection';
// import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';
// import { SIMULATE_3DS_URL } from './3ds-elements/frame';
// import { start3dsVerification } from './3ds-elements/events';

export class OpenPayFormEventHandler {
  formInstance: OpenPayForm;
  eventTargets: Record<string, MessageEventSource>;
  private nonces: Set<string>;
  private formId: string;
  private config: OpenPayForm['config'];

  constructor(formInstance: OpenPayForm) {
    this.formInstance = formInstance;
    this.config = formInstance.config;
    this.formId = formInstance.formId;
    this.eventTargets = {};
    this.nonces = new Set();
  }

  handleMessage(event: MessageEvent) {
    if (!event.source) {
      throw new Error(`No source found`);
    }
    if (event.origin !== this.formInstance.config._frameUrl?.origin) {
      // Skipping if origin does not match
      return;
    }
    if (typeof event.data === 'object' && event.data['penpal']) {
      // Penpal message, do not handle
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
      case 'LOAD_ERROR':
        this.handleLoadErrorEvent(payload);
        break;
      case 'VALIDATION_ERROR':
        this.handleValidationErrorEvent(payload, elementId);
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

  async handleLoadedEvent(source: MessageEventSource, elementId: string, payload: LoadedEventPayload) {
    console.log('handleLoadedEvent is deprecated:', source, elementId, payload);
    // const status = await start3dsVerification({ url: SIMULATE_3DS_URL, baseUrl: this.config.baseUrl! });
    // console.log('🔐 3DS status:', status);
    this.eventTargets[elementId] = source;
    // console.log('handleLoadedEvent XXXXXXXXX', payload);
    this.formInstance.onCdeLoaded(payload);
    if (this.config.onLoad) {
      this.config.onLoad(payload.totalAmountAtoms, payload.currency);
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

  // async handleErrorEvent(payload: ErrorEventPayload) {
  //   if (payload.message === '3DS_REQUIRED') {
  //     const threeDSUrl = payload.headers?.['x-3ds-auth-url'] ?? SIMULATE_3DS_URL;
  //     // This will open a popup and process the 3DS flow
  //     // will return a status `success` | `failure` | `cancelled` which we can continue with
  //     const status = await start3dsVerification({ url: threeDSUrl, baseUrl: this.config.baseUrl! });
  //     console.log('🔐 3DS status:', status);
  //     // TODO: continue with status

  //     const cardCpm = this.formInstance.checkoutPaymentMethods?.find((cpm) => cpm.provider === 'credit_card');
  //     if (!this.formInstance.sessionId || !this.formInstance.formTarget || !this.config.onValidationError || !cardCpm)
  //       return;

  //     for (const [elementId, target] of Object.entries(this.eventTargets)) {
  //       if (!target) continue;
  //       const startPaymentFlowEvent = constructSubmitEventPayload(
  //         EventType.enum.START_PAYMENT_FLOW,
  //         this.formInstance.sessionId,
  //         document.querySelector(this.formInstance.formTarget) ?? document.body,
  //         this.config.onValidationError,
  //         { ...cardCpm, processor_name: 'stripe' },
  //         false
  //       );
  //       if (!startPaymentFlowEvent) continue;
  //       this.formInstance.checkoutFired = true;
  //       this.tokenizedData = startPaymentFlowEvent;
  //       this.postEventToFrame(target, elementId, startPaymentFlowEvent);
  //       break;
  //     }
  //   } else {
  //     this.formInstance.checkoutFired = false;
  //     if (this.formInstance.config.onCheckoutError) this.formInstance.config.onCheckoutError(payload.message);
  //   }
  // }

  // handleFormSubmit() {
  //   if (
  //     !this.formInstance.sessionId ||
  //     !this.formInstance.checkoutPaymentMethods?.length ||
  //     !this.config.onValidationError
  //   ) {
  //     return;
  //   }
  //   const cardCpm = this.formInstance.checkoutPaymentMethods.find((cpm) => cpm.provider === 'credit_card');

  //   if (!cardCpm) {
  //     throw new Error('Card not available as a payment method in checkout');
  //   }

  //   const tokenizeData = constructSubmitEventPayload(
  //     EventType.enum.TOKENIZE,
  //     this.formInstance.sessionId!,
  //     document.querySelector(this.formInstance.formTarget) ?? document.body,
  //     this.config.onValidationError,
  //     cardCpm,
  //     false
  //   );
  //   if (!tokenizeData) {
  //     throw new Error('Error constructing tokenize data');
  //   }
  //   for (const [elementId, target] of Object.entries(this.eventTargets)) {
  //     if (!target) continue;
  //     this.postEventToFrame(target, elementId, tokenizeData);
  //   }
  //   this.tokenizedData = tokenizeData;
  // }

  // async onUserCompletePaymentRequestUI(
  //   stripePm: PaymentRequestPaymentMethodEvent,
  //   checkoutPaymentMethod: CheckoutPaymentMethod
  // ): Promise<void> {
  //   if (!this.config.onValidationError || !this.formInstance.sessionId || !this.formInstance.checkoutPaymentMethods)
  //     return;

  //   for (const [elementId, element] of Object.entries(this.eventTargets ?? {})) {
  //     const paymentFlowMetadata = { stripePmId: stripePm.paymentMethod.id };
  //     const startPaymentFlowEvent = constructSubmitEventPayload(
  //       EventType.enum.START_PAYMENT_FLOW,
  //       this.formInstance.sessionId,
  //       document.querySelector(this.formInstance.formTarget) ?? document.body,
  //       this.config.onValidationError,
  //       checkoutPaymentMethod,
  //       false,
  //       paymentFlowMetadata
  //     );
  //     if (!startPaymentFlowEvent) continue;
  //     this.stripePm = stripePm;
  //     this.formInstance.checkoutFired = true;
  //     this.setTokenizedData(startPaymentFlowEvent);
  //     this.postEventToFrame(element, elementId, startPaymentFlowEvent);
  //     // emitEvent(element.node.contentWindow!, this.formId, elementId, startPaymentFlowEvent, this.config.baseUrl!);
  //     break;
  //   }
  // }

  postEventToFrame(source: MessageEventSource, elementId: string, data: EventPayload) {
    emitEvent(source, this.formId, elementId, data, this.config.baseUrl!);
  }
}
