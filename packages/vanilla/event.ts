import { ElementEvent, LoadedEventPayload, parseEventPayload, FormCallbacks } from '@getopenpay/utils';

// TODO: eventually refactor this to be called by OpenPayForm instead
type InternalCallbacks = {
  onCdeLoaded: (payload: LoadedEventPayload) => void;
  onCdeLoadError: (errMsg: string) => void;
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

    let eventData = null;
    // Events from third party often produce invalid json
    try {
      eventData = parseEventPayload(JSON.parse(event.data));
    } catch (e) {
      console.warn('[OJS] Unknown event. Ignoring:', e);
      return;
    }

    const isValid = this.validateEvent(eventData);
    if (!isValid) return;

    const { elementId, payload } = eventData;
    const eventType = payload.type;

    switch (eventType) {
      case 'LAYOUT':
        this.internalCallbacks.setFormHeight(payload.height ? `${payload.height}px` : '100%');
        break;
      case 'FOCUS':
        this.formCallbacks.get.onFocus(elementId, payload.elementType);
        break;
      case 'BLUR':
        this.formCallbacks.get.onBlur(elementId, payload.elementType);
        break;
      case 'CHANGE':
        this.formCallbacks.get.onChange(elementId, payload.elementType, payload.errors);
        break;
      case 'LOADED':
        this.eventTargets[elementId] = event.source;
        this.internalCallbacks.onCdeLoaded(payload);
        break;
      case 'LOAD_ERROR':
        this.internalCallbacks.onCdeLoadError(payload.message);
        break;
      case 'VALIDATION_ERROR':
        this.formCallbacks.get.onValidationError(payload.elementType, payload.errors, elementId);
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
}

const getCleanOrigin = (url: string) => {
  return new URL(url).origin;
};
