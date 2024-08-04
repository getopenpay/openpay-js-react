import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { FRAME_BASE_URL } from './constants';

/**
 * Start of common event stuff
 * Don't forget to update in app-cde:frontend/utils/elements/event.ts also!
 */

const EVENT_PREFIX = 'op-elements';

export enum ElementEventType {
  LOADED = `${EVENT_PREFIX}-loaded`,
  VALIDATION_ERROR = `${EVENT_PREFIX}-validation-error`,
  BLUR = `${EVENT_PREFIX}-blur`,
  FOCUS = `${EVENT_PREFIX}-focus`,
  CHANGE = `${EVENT_PREFIX}-change`,
  RESIZE = `${EVENT_PREFIX}-resize`,
}

export const ElementEventSchema = z.object({
  type: z.nativeEnum(ElementEventType),
  payload: z.object({}).catchall(z.string()),
  nonce: z.string(),
  formId: z.string(),
  elementId: z.string(),
});
export type ElementEvent = z.infer<typeof ElementEventSchema>;

export const parseEventPayload = (eventData: object): ElementEvent => {
  try {
    return ElementEventSchema.parse(eventData);
  } catch (error) {
    console.error('Error parsing event payload:', eventData, error);
    throw error;
  }
};

/**
 * End of common event stuff
 */

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
