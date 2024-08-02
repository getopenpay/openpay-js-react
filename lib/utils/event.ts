import { z } from 'zod';

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

/**
 * End of common event stuff
 */

export const parseEventPayload = (eventData: object): ElementEvent => {
  try {
    return ElementEventSchema.parse(eventData);
  } catch (error) {
    console.error('Error parsing event payload:', eventData, error);
    throw error;
  }
};
