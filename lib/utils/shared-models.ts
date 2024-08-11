import { z } from 'zod';

/**
 * Models shared between CDE and OpenPay.js
 * Don't forget to update shared-models.ts in the other repo's utils folder too!
 */

/**
 * Styles
 */

export const ElementsStyle = z.object({
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  margin: z.string().optional(),
  padding: z.string().optional(),
});
export type ElementsStyle = z.infer<typeof ElementsStyle>;

/**
 * Form field names
 */

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

/**
 * Event types
 * Element here refers to the page rendered in CDE,
 * while Form refers to the page hosting the Element iframes.
 */

const EVENT_PREFIX = 'op-elements';

export enum ElementEventType {
  // Element -> Form
  LOADED = `${EVENT_PREFIX}-loaded`,
  BLUR = `${EVENT_PREFIX}-blur`,
  FOCUS = `${EVENT_PREFIX}-focus`,
  CHANGE = `${EVENT_PREFIX}-change`,
  TOKENIZE_SUCCESS = `${EVENT_PREFIX}-tokenize-success`,
  CHECKOUT_SUCCESS = `${EVENT_PREFIX}-checkout-success`,
  LOAD_ERROR = `${EVENT_PREFIX}-load-error`,
  VALIDATION_ERROR = `${EVENT_PREFIX}-validation-error`,
  TOKENIZE_ERROR = `${EVENT_PREFIX}-tokenize-error`,
  CHECKOUT_ERROR = `${EVENT_PREFIX}-checkout-error`,

  // Form -> Element
  TOKENIZE = `${EVENT_PREFIX}-tokenize`,
  CHECKOUT = `${EVENT_PREFIX}-checkout`,
}

/**
 * Event payload schemas
 */

// Field events
export const FieldEventPayload = z.object({
  type: z.union([
    z.literal(ElementEventType.BLUR),
    z.literal(ElementEventType.FOCUS),
    z.literal(ElementEventType.CHANGE),
  ]),
});
export type FieldEventPayload = z.infer<typeof FieldEventPayload>;

// Generic error events
export const ErrorEventPayload = z.object({
  type: z.union([
    z.literal(ElementEventType.LOAD_ERROR),
    z.literal(ElementEventType.VALIDATION_ERROR),
    z.literal(ElementEventType.TOKENIZE_ERROR),
    z.literal(ElementEventType.CHECKOUT_ERROR),
  ]),
  message: z.string(),
});
export type ErrorEventPayload = z.infer<typeof ErrorEventPayload>;

export const LoadedEventPayload = z.object({
  type: z.literal(ElementEventType.LOADED),
  height: z.string(),
});
export type LoadedEventPayload = z.infer<typeof LoadedEventPayload>;

export const SubmitEventPayload = z.object({
  type: z.union([z.literal(ElementEventType.TOKENIZE), z.literal(ElementEventType.CHECKOUT)]),
  [FieldName.FIRST_NAME]: z.string(),
  [FieldName.LAST_NAME]: z.string(),
  [FieldName.EMAIL]: z.string(),
  [FieldName.ZIP_CODE]: z.string(),
  [FieldName.COUNTRY]: z.string(),
});
export type SubmitEventPayload = z.infer<typeof SubmitEventPayload>;

export const TokenizeSuccessEventPayload = z.object({
  type: z.literal(ElementEventType.TOKENIZE_SUCCESS),
  paymentToken: z.string(),
});
export type TokenizeSuccessEventPayload = z.infer<typeof TokenizeSuccessEventPayload>;

export const CheckoutSuccessEventPayload = z.object({
  type: z.literal(ElementEventType.CHECKOUT_SUCCESS),
  invoiceUrls: z.array(z.string()),
});
export type CheckoutSuccessEventPayload = z.infer<typeof CheckoutSuccessEventPayload>;

// Discriminated union of event payloads
export const EventPayload = z.discriminatedUnion('type', [
  FieldEventPayload,
  ErrorEventPayload,
  LoadedEventPayload,
  SubmitEventPayload,
  TokenizeSuccessEventPayload,
  CheckoutSuccessEventPayload,
]);
export type EventPayload = z.infer<typeof EventPayload>;

/**
 * Event schema
 */

export const ElementEvent = z.object({
  payload: EventPayload,
  nonce: z.string(),
  formId: z.string(),
  elementId: z.string(),
});
export type ElementEvent = z.infer<typeof ElementEvent>;
