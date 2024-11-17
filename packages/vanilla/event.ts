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

  handleLoadErrorEvent(payload: ErrorEventPayload) {
    if (this.formInstance.config.onLoadError) this.formInstance.config.onLoadError(payload.message);
  }

  handleValidationErrorEvent(payload: ValidationErrorEventPayload, elementId: string) {
    if (this.formInstance.config.onValidationError) {
      this.formInstance.config.onValidationError(payload.elementType, payload.errors, elementId);
    }
  }

  postEventToFrame(source: MessageEventSource, elementId: string, data: EventPayload) {
    emitEvent(source, this.formId, elementId, data, this.config.baseUrl!);
  }
}
