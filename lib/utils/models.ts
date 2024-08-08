import { z } from 'zod';

/**
 * Start of common event stuff
 * Don't forget to update in app-cde:frontend/utils/elements/models.ts also!
 */

const EVENT_PREFIX = 'op-elements';

export enum ElementEventType {
  LOADED = `${EVENT_PREFIX}-loaded`,
  VALIDATION_ERROR = `${EVENT_PREFIX}-validation-error`,
  BLUR = `${EVENT_PREFIX}-blur`,
  FOCUS = `${EVENT_PREFIX}-focus`,
  CHANGE = `${EVENT_PREFIX}-change`,
  SUBMIT = `${EVENT_PREFIX}-submit`,
  SUBMIT_ERROR = `${EVENT_PREFIX}-submit-error`,
  SUBMIT_SUCCESS = `${EVENT_PREFIX}-submit-success`,
}

export const ElementEventSchema = z.object({
  type: z.nativeEnum(ElementEventType),
  payload: z.object({}).catchall(z.string()),
  nonce: z.string(),
  formId: z.string(),
  elementId: z.string(),
});
export type ElementEvent = z.infer<typeof ElementEventSchema>;

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

export const SubmitDataSchema = z.object({
  checkoutSecureToken: z.string(),
  [FieldName.FIRST_NAME]: z.string(),
  [FieldName.LAST_NAME]: z.string(),
  [FieldName.EMAIL]: z.string().optional(),
  [FieldName.ZIP_CODE]: z.string().optional(),
  [FieldName.CITY]: z.string().optional(),
  [FieldName.STATE]: z.string().optional(),
  [FieldName.COUNTRY]: z.string().optional(),
  [FieldName.ADDRESS]: z.string().optional(),
  [FieldName.PHONE]: z.string().optional(),
});

export type SubmitData = z.infer<typeof SubmitDataSchema>;

/**
 * End of common event stuff
 * Don't forget to update in app-cde:frontend/utils/elements/models.ts also!
 */
