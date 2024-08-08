import { v4 as uuidv4 } from 'uuid';
import { FRAME_BASE_URL } from './constants';
import { type ElementEvent, ElementEventType, ElementEventSchema, SubmitDataSchema } from './models';

export const parseEventPayload = (eventData: object): ElementEvent => {
  try {
    return ElementEventSchema.parse(eventData);
  } catch (error) {
    console.error('Error parsing event payload:', eventData, error);
    throw error;
  }
};

export const submitForm = (
  frame: HTMLIFrameElement,
  formId: string,
  data: Record<string, string>
) => {
  const payload = SubmitDataSchema.safeParse(data);
  if (!payload.success) throw new Error('Invalid submit data: ' + JSON.stringify(payload.error));

  emitEvent(frame, formId, 'root', ElementEventType.SUBMIT, payload.data);
};

export const emitEvent = (
  frame: HTMLIFrameElement,
  formId: string,
  elementId: string,
  type: ElementEventType,
  payload: Record<string, string>
) => {
  const target = frame.contentWindow;
  if (!target) {
    console.error('[form] Cannot emit event, no contentWindow found:', frame);
    return;
  }

  const event: ElementEvent = {
    type,
    formId,
    elementId,
    payload,
    nonce: uuidv4(),
  };

  console.log(`[form] Emitting event ${type} from parent form ${formId} to child element ${elementId}:`, event);
  target.postMessage(JSON.stringify(event), FRAME_BASE_URL);
};
