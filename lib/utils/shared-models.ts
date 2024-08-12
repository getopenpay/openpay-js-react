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

export const EventType = z.enum([
  // Element -> Form
  'LOADED',
  'BLUR',
  'FOCUS',
  'CHANGE',
  'TOKENIZE_STARTED',
  'CHECKOUT_STARTED',
  'TOKENIZE_SUCCESS',
  'CHECKOUT_SUCCESS',
  'LOAD_ERROR',
  'VALIDATION_ERROR',
  'TOKENIZE_ERROR',
  'CHECKOUT_ERROR',

  // Form -> Element
  'TOKENIZE',
  'CHECKOUT',
]);

/**
 * Event payload schemas
 */

// Events that don't have a specific payload
const GenericEventType = EventType.extract(['BLUR', 'FOCUS', 'CHANGE', 'TOKENIZE_STARTED', 'CHECKOUT_STARTED']);
type GenericEventType = z.infer<typeof GenericEventType>;
export const GenericEventPayload = z.object({ type: GenericEventType });
export type GenericEventPayload = z.infer<typeof GenericEventPayload>;

// Generic error events
const ErrorEventType = EventType.extract(['LOAD_ERROR', 'VALIDATION_ERROR', 'TOKENIZE_ERROR', 'CHECKOUT_ERROR']);
type ErrorEventType = z.infer<typeof ErrorEventType>;

export const ErrorEventPayload = z.object({
  type: ErrorEventType,
  message: z.string(),
});
export type ErrorEventPayload = z.infer<typeof ErrorEventPayload>;

export const LoadedEventPayload = z.object({
  type: z.literal(EventType.enum.LOADED),
  height: z.string(),
  totalAmountAtoms: z.number(),
});
export type LoadedEventPayload = z.infer<typeof LoadedEventPayload>;

const SubmitEventType = EventType.extract(['TOKENIZE', 'CHECKOUT']);
type SubmitEventType = z.infer<typeof SubmitEventType>;
export const SubmitEventPayload = z.object({
  type: SubmitEventType,
  [FieldName.FIRST_NAME]: z.string(),
  [FieldName.LAST_NAME]: z.string(),
  [FieldName.EMAIL]: z.string(),
  [FieldName.ZIP_CODE]: z.string(),
  [FieldName.COUNTRY]: z.string(),
});
export type SubmitEventPayload = z.infer<typeof SubmitEventPayload>;

export const TokenizeSuccessEventPayload = z.object({
  type: z.literal(EventType.enum.TOKENIZE_SUCCESS),
  paymentToken: z.string(),
  isReadyForCheckout: z.boolean(),
});
export type TokenizeSuccessEventPayload = z.infer<typeof TokenizeSuccessEventPayload>;

export const CheckoutSuccessEventPayload = z.object({
  type: z.literal(EventType.enum.CHECKOUT_SUCCESS),
  invoiceUrls: z.array(z.string()),
});
export type CheckoutSuccessEventPayload = z.infer<typeof CheckoutSuccessEventPayload>;

// Discriminated union of event payloads
export const EventPayload = z.discriminatedUnion('type', [
  GenericEventPayload,
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
