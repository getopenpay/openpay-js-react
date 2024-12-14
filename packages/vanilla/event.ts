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
  FormCallbacks,
} from '@getopenpay/utils';

// TODO: eventually refactor this to be called by OpenPayForm instead
type InternalCallbacks = {
  onCdeLoaded: (payload: LoadedEventPayload) => void;
  setFormHeight: (height: string) => void;
};

export class OpenPayFormEventHandler {
  eventTargets: Record<string, MessageEventSource>;
  private nonces: Set<string>;
  private formId: string;
  private baseUrl: string;
  private formCallbacks: FormCallbacks;
  private internalCallbacks: InternalCallbacks;
  constructor(formId: string, baseUrl: string, formCallbacks: FormCallbacks, internalCallbacks: InternalCallbacks) {
    this.eventTargets = {};
    this.nonces = new Set();
    this.formId = formId;
    this.baseUrl = baseUrl;
    this.formCallbacks = formCallbacks;
    this.internalCallbacks = internalCallbacks;
  }

  handleMessage = (event: MessageEvent) => {
    if (!event.source) {
      throw new Error(`No source found`);
    }
    if (getCleanOrigin(event.origin) !== getCleanOrigin(this.baseUrl)) {
      // Skipping if origin does not match
      // console.warn(`[OJS] Received messages with mismatched origin. Got: ${event.origin}, Expected: ${this.baseUrl}`);
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
  };

  validateEvent = (eventData: ElementEvent) => {
    if (eventData.formId !== this.formId || !eventData.elementId) {
      console.log('[OJS] formId', this.formId, eventData.formId);
      console.warn('[form] Ignoring unknown event:', eventData);
      return false;
    }

    if (this.nonces.has(eventData.nonce)) {
      console.warn('[form] Ignoring duplicate event:', eventData);
      return false;
    }

    this.nonces.add(eventData.nonce);

    return true;
  };

  handleLayoutEvent = (payload: LayoutEventPayload) => {
    const height = payload.height ? `${payload.height}px` : '100%';
    this.internalCallbacks.setFormHeight(height);
  };

  handleFocusEvent = (elementId: string, field: AllFieldNames) => {
    if (this.formCallbacks.onFocus) this.formCallbacks.onFocus(elementId, field);
  };

  handleBlurEvent = (elementId: string, field: AllFieldNames) => {
    if (this.formCallbacks.onBlur) this.formCallbacks.onBlur(elementId, field);
  };

  handleChangeEvent = (elementId: string, field: AllFieldNames, errors?: string[]) => {
    if (this.formCallbacks.onChange) this.formCallbacks.onChange(elementId, field, errors);
  };

  handleLoadedEvent = async (source: MessageEventSource, elementId: string, payload: LoadedEventPayload) => {
    // console.log('handleLoadedEvent is deprecated:', source, elementId, payload);
    this.eventTargets[elementId] = source;
    this.internalCallbacks.onCdeLoaded(payload);
    if (this.formCallbacks.onLoad) {
      this.formCallbacks.onLoad(payload.totalAmountAtoms, payload.currency);
    }
  };

  handleLoadErrorEvent = (payload: ErrorEventPayload) => {
    if (this.formCallbacks.onLoadError) this.formCallbacks.onLoadError(payload.message);
  };

  handleValidationErrorEvent = (payload: ValidationErrorEventPayload, elementId: string) => {
    if (this.formCallbacks.onValidationError) {
      this.formCallbacks.onValidationError(payload.elementType, payload.errors, elementId);
    }
  };

  postEventToFrame = (source: MessageEventSource, elementId: string, data: EventPayload) => {
    emitEvent(source, this.formId, elementId, data, this.baseUrl);
  };
}

const getCleanOrigin = (url: string) => {
  return new URL(url).origin;
};
