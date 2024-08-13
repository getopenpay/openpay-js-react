import { z } from 'zod';

/**
 * Models shared between CDE and OpenPay.js
 * Don't forget to update shared-models.ts in the other repo's utils folder too!
 */

const RequiredString = z.string().trim().min(1, { message: `Cannot be blank` });
const OptionalString = z.string().trim().optional();

/**
 * Expected input fields
 */

export enum FieldName {
  // Comes directly from CDE iframes
  CARD_NUMBER = 'cardNumber',
  CARD_EXPIRY = 'cardExpiry',
  CARD_CVC = 'cardCvc',

  // Supplied by the user
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
export const FieldNameEnum = z.nativeEnum(FieldName);
export type FieldNameEnum = z.infer<typeof FieldNameEnum>;

/**
 * Styles
 */

export const ElementsStyle = z.object({
  backgroundColor: OptionalString,
  color: OptionalString,
  fontFamily: OptionalString,
  fontSize: OptionalString,
  fontWeight: OptionalString,
  margin: OptionalString,
  padding: OptionalString,
});
export type ElementsStyle = z.infer<typeof ElementsStyle>;

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
const GenericEventType = EventType.extract(['TOKENIZE_STARTED', 'CHECKOUT_STARTED']);
type GenericEventType = z.infer<typeof GenericEventType>;
export const GenericEventPayload = z.object({ type: GenericEventType });
export type GenericEventPayload = z.infer<typeof GenericEventPayload>;

// Input field events
const InputEventType = EventType.extract(['BLUR', 'FOCUS', 'CHANGE']);
type InputEventType = z.infer<typeof InputEventType>;
export const InputEventPayload = z.object({
  type: InputEventType,
  elementType: FieldNameEnum,
});
export type InputEventPayload = z.infer<typeof InputEventPayload>;

// Generic error events
const ErrorEventType = EventType.extract(['LOAD_ERROR', 'TOKENIZE_ERROR', 'CHECKOUT_ERROR']);
type ErrorEventType = z.infer<typeof ErrorEventType>;
export const ErrorEventPayload = z.object({
  type: ErrorEventType,
  message: RequiredString,
});
export type ErrorEventPayload = z.infer<typeof ErrorEventPayload>;

const ValidationErrorEventType = EventType.extract(['VALIDATION_ERROR']);
type ValidationErrorEventType = z.infer<typeof ValidationErrorEventType>;
export const ValidationErrorEventPayload = z.object({
  type: ValidationErrorEventType,
  elementType: FieldNameEnum,
  errors: z.array(z.string()),
});
export type ValidationErrorEventPayload = z.infer<typeof ValidationErrorEventPayload>;

export const LoadedEventPayload = z.object({
  type: z.literal(EventType.enum.LOADED),
  height: RequiredString,
  totalAmountAtoms: z.number(),
  currency: OptionalString,
});
export type LoadedEventPayload = z.infer<typeof LoadedEventPayload>;

const SubmitEventType = EventType.extract(['TOKENIZE', 'CHECKOUT']);
type SubmitEventType = z.infer<typeof SubmitEventType>;
export const SubmitEventPayload = z.object({
  type: SubmitEventType,
  [FieldName.FIRST_NAME]: RequiredString,
  [FieldName.LAST_NAME]: RequiredString,
  [FieldName.EMAIL]: RequiredString,
  [FieldName.ZIP_CODE]: RequiredString,
  [FieldName.COUNTRY]: RequiredString,
});
export type SubmitEventPayload = z.infer<typeof SubmitEventPayload>;

export const TokenizeSuccessEventPayload = z.object({
  type: z.literal(EventType.enum.TOKENIZE_SUCCESS),
  paymentToken: RequiredString,
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
  InputEventPayload,
  ErrorEventPayload,
  ValidationErrorEventPayload,
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
  nonce: RequiredString,
  formId: RequiredString,
  elementId: RequiredString,
});
export type ElementEvent = z.infer<typeof ElementEvent>;
