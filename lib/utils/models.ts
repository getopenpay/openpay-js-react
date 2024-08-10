import { z } from 'zod';

/**
 * Start of common event stuff
 * Don't forget to update in app-cde:frontend/utils/elements/models.ts also!
 */

const EVENT_PREFIX = 'op-elements';

export enum ElementEventType {
  LOADED = `${EVENT_PREFIX}-loaded`,
  LOAD_ERROR = `${EVENT_PREFIX}-load-error`,
  VALIDATION_ERROR = `${EVENT_PREFIX}-validation-error`,
  BLUR = `${EVENT_PREFIX}-blur`,
  FOCUS = `${EVENT_PREFIX}-focus`,
  CHANGE = `${EVENT_PREFIX}-change`,
  SUBMIT = `${EVENT_PREFIX}-submit`,
  SUBMIT_ERROR = `${EVENT_PREFIX}-submit-error`,
  SUBMIT_SUCCESS = `${EVENT_PREFIX}-submit-success`,
}

export const ElementEvent = z.object({
  type: z.nativeEnum(ElementEventType),
  payload: z.object({}).catchall(z.string()),
  nonce: z.string(),
  formId: z.string(),
  elementId: z.string(),
});
export type ElementEvent = z.infer<typeof ElementEvent>;

export enum FieldName {
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  EMAIL = 'email',
  ZIP_CODE = 'zipCode',
  CITY = 'city',
  STATE = 'state',
  COUNTRY = 'country',
  ADDRESS = 'address',
  PHONE = 'phone',
}

export const SubmitEvent = z.object({
  [FieldName.FIRST_NAME]: z.string(),
  [FieldName.LAST_NAME]: z.string(),
  [FieldName.EMAIL]: z.string(),
  [FieldName.ZIP_CODE]: z.string(),
  [FieldName.COUNTRY]: z.string(),
});

export type SubmitEvent = z.infer<typeof SubmitEvent>;

/**
 * End of common event stuff
 * Don't forget to update in app-cde:frontend/utils/elements/models.ts also!
 */
