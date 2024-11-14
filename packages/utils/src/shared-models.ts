import { z } from 'zod';

/**
 * Models shared between CDE and OpenPay.js
 * Don't forget to update shared-models.ts in the other repo's utils folder too!
 */

const RequiredString = z.string().trim().min(1, { message: `Cannot be blank` });
export const OptionalString = z.string().trim().optional();
export const nullOrUndefOr = <T extends z.ZodType>(zType: T): z.ZodNullable<z.ZodOptional<T>> =>
  z.nullable(zType.optional());

/**
 * Expected input fields
 */

// Supplied by the user
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
  PROMOTION_CODE = 'promotionCode',
}
export const FieldNameEnum = z.nativeEnum(FieldName);
export type FieldNameEnum = z.infer<typeof FieldNameEnum>;

// Comes directly from CDE iframes
export enum PrivateFieldName {
  CARD_NUMBER = 'cardNumber',
  CARD_EXPIRY = 'cardExpiry',
  CARD_CVC = 'cardCvc',
}
export const PrivateFieldNameEnum = z.nativeEnum(PrivateFieldName);
export type PrivateFieldNameEnum = z.infer<typeof PrivateFieldNameEnum>;

export const AllFieldNames = z.union([FieldNameEnum, PrivateFieldNameEnum]);
export type AllFieldNames = z.infer<typeof AllFieldNames>;

export type ElementType = 'card' | 'card-number' | 'card-expiry' | 'card-cvc';

/**
 * Core models
 */

// CheckoutPaymentMethod
export const CheckoutPaymentMethod = z.object({
  provider: z.string(),
  processor_name: nullOrUndefOr(z.string()),
  metadata: nullOrUndefOr(z.record(z.string(), z.any())),
});
export type CheckoutPaymentMethod = z.infer<typeof CheckoutPaymentMethod>;

// PaymentMethodMinimal
export const PaymentMethodMinimal = z.object({
  id: z.string(),
});
export type PaymentMethodMinimal = z.infer<typeof PaymentMethodMinimal>;

export const CardPlaceholder = z.object({
  cardNumber: OptionalString,
  expiry: OptionalString,
  cvc: OptionalString,
});

export type CardPlaceholder = z.infer<typeof CardPlaceholder>;

/**
 * Styles
 */

export const BaseElementsStyle = z.object({
  backgroundColor: OptionalString,
  color: OptionalString,
  fontFamily: OptionalString,
  fontSize: OptionalString,
  fontWeight: OptionalString,
  margin: OptionalString,
  padding: OptionalString,
  letterSpacing: OptionalString,
  lineHeight: OptionalString,
});

export type BaseElementsStyle = z.infer<typeof BaseElementsStyle>;

// Just inferencing the type here for simplicity
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ElementsStyle = <T extends z.ZodTypeAny>(placeholderType: T) =>
  BaseElementsStyle.extend({
    placeholder: placeholderType,
    placeholderStyle: z
      .object({
        color: OptionalString,
        fontSize: OptionalString,
        fontWeight: OptionalString,
        fontFamily: OptionalString,
        letterSpacing: OptionalString,
        lineHeight: OptionalString,
      })
      .optional(),
  });

// Generic type for ElementsStyle where T is the placeholder type
export type ElementsStyle<T extends z.ZodTypeAny> = z.infer<ReturnType<typeof ElementsStyle<T>>>;

/**
 * Event types
 * Element here refers to the page rendered in CDE,
 * while Form refers to the page hosting the Element iframes.
 */

export const EventType = z.enum([
  // Element -> Form
  'LAYOUT',
  'LOADED',
  'BLUR',
  'FOCUS',
  'CHANGE',
  'TOKENIZE_STARTED',
  'CHECKOUT_STARTED',
  'PAYMENT_FLOW_STARTED',
  'TOKENIZE_SUCCESS',
  'CHECKOUT_SUCCESS',
  'LOAD_ERROR',
  'VALIDATION_ERROR',
  'TOKENIZE_ERROR',
  'CHECKOUT_ERROR',
  'SETUP_PAYMENT_METHOD_SUCCESS',

  // Form -> Element
  'TOKENIZE',
  'CHECKOUT',
  'START_PAYMENT_FLOW',
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
  elementType: PrivateFieldNameEnum,
  errors: z.array(z.string()).optional(),
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
  elementType: AllFieldNames,
  errors: z.array(z.string()),
});
export type ValidationErrorEventPayload = z.infer<typeof ValidationErrorEventPayload>;

export const LayoutEventPayload = z.object({
  type: z.literal(EventType.enum.LAYOUT),
  height: RequiredString,
});

export type LayoutEventPayload = z.infer<typeof LayoutEventPayload>;

export const LoadedEventPayload = z.object({
  type: z.literal(EventType.enum.LOADED),
  sessionId: RequiredString,
  totalAmountAtoms: z.number(),
  currency: OptionalString,
  checkoutPaymentMethods: z.array(CheckoutPaymentMethod),
});
export type LoadedEventPayload = z.infer<typeof LoadedEventPayload>;

export const PaymentFlowStartedEventPayload = z.object({
  type: z.literal(EventType.enum.PAYMENT_FLOW_STARTED),
  nextActionMetadata: z.record(z.string(), z.any()),
  paymentFlowMetadata: z.any().optional(),
  startPFMetadata: z.optional(z.record(z.string(), z.any())),
});
export type PaymentFlowStartedEventPayload = z.infer<typeof PaymentFlowStartedEventPayload>;

export const SetupCheckoutSuccessEventPayload = z.object({
  type: z.literal(EventType.enum.SETUP_PAYMENT_METHOD_SUCCESS),
  paymentMethodId: z.string(),
});

export type SetupCheckoutSuccessEventPayload = z.infer<typeof SetupCheckoutSuccessEventPayload>;

export const RequiredFormFields = z.object({
  [FieldName.FIRST_NAME]: RequiredString,
  [FieldName.LAST_NAME]: RequiredString,
  [FieldName.EMAIL]: RequiredString,
  [FieldName.ZIP_CODE]: RequiredString,
  [FieldName.COUNTRY]: RequiredString,
  [FieldName.PROMOTION_CODE]: OptionalString,
});
export type RequiredFormFields = z.infer<typeof RequiredFormFields>;

const SubmitEventType = EventType.extract(['TOKENIZE', 'CHECKOUT', 'START_PAYMENT_FLOW']);
type SubmitEventType = z.infer<typeof SubmitEventType>;
export const SubmitEventPayload = z
  .object({
    type: SubmitEventType,
    sessionId: RequiredString,
    checkoutPaymentMethod: CheckoutPaymentMethod,
    paymentFlowMetadata: z.any().optional(),
    doNotUseLegacyCCFlow: z.boolean().optional(),
    existingCCPMId: OptionalString,
  })
  .extend(RequiredFormFields.shape);
export type SubmitEventPayload = z.infer<typeof SubmitEventPayload>;

export const TokenizeSuccessEventPayload = z.object({
  type: z.literal(EventType.enum.TOKENIZE_SUCCESS),
  isReadyForCheckout: z.boolean(),
});
export type TokenizeSuccessEventPayload = z.infer<typeof TokenizeSuccessEventPayload>;

export const CheckoutSuccessEventPayload = z.object({
  type: z.literal(EventType.enum.CHECKOUT_SUCCESS),
  invoiceUrls: z.array(z.string()),
  subscriptionIds: z.array(z.string()),
  customerId: z.string(),
});
export type CheckoutSuccessEventPayload = z.infer<typeof CheckoutSuccessEventPayload>;

// Discriminated union of event payloads
export const EventPayload = z.discriminatedUnion('type', [
  GenericEventPayload,
  InputEventPayload,
  ErrorEventPayload,
  ValidationErrorEventPayload,
  LayoutEventPayload,
  LoadedEventPayload,
  SubmitEventPayload,
  TokenizeSuccessEventPayload,
  CheckoutSuccessEventPayload,
  PaymentFlowStartedEventPayload,
  SetupCheckoutSuccessEventPayload,
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

/**
 * Payment requests
 */

export const Amount = z.object({
  amountAtom: z.number(),
  currency: RequiredString,
});
export type Amount = z.infer<typeof Amount>;

export type PaymentRequestStartParams = {
  overridePaymentRequest?: {
    amount: Amount;
    pending: boolean;
  };
};

// Using vanilla TS type here because we can't make named function args in zod
export type PaymentRequestStatus = {
  isLoading: boolean;
  isAvailable: boolean;
  startFlow: (params?: PaymentRequestStartParams) => Promise<void>;
};

// CheckoutPreviewRequest
export const CheckoutPreviewRequest = z.object({
  secure_token: z.string(),
  promotion_code: z.string().optional(),
});
export type CheckoutPreviewRequest = z.infer<typeof CheckoutPreviewRequest>;

// ConfirmPaymentFlowRequest
export const ConfirmPaymentFlowRequest = z.object({
  secure_token: z.string(),
  existing_cc_pm_id: nullOrUndefOr(z.string()),
});
export type ConfirmPaymentFlowRequest = z.infer<typeof ConfirmPaymentFlowRequest>;

// ConfirmPaymentFlowResponse
export const ConfirmPaymentFlowResponse = z.object({
  payment_methods: z.array(PaymentMethodMinimal),
});
export type ConfirmPaymentFlowResponse = z.infer<typeof ConfirmPaymentFlowResponse>;

// FieldValidationError
export const FieldValidationError = z.object({
  elementType: z.string(),
  errors: z.array(z.string()),
});
export type FieldValidationError = z.infer<typeof FieldValidationError>;

// TokenizeCardRequest
export const TokenizeCardRequest = z.object({
  session_id: z.string(),
});
export type TokenizeCardRequest = z.infer<typeof TokenizeCardRequest>;

// TokenizeCardErrorResponse
export const TokenizeCardErrorResponse = z.object({
  success: z.literal(false),
  error_type: z.literal('validation_error'),
  errors: z.array(FieldValidationError),
});
export type TokenizeCardErrorResponse = z.infer<typeof TokenizeCardErrorResponse>;

// TokenizeCardResponse
export const TokenizeCardResponse = z.discriminatedUnion('success', [
  z.object({ success: z.literal(true) }),
  TokenizeCardErrorResponse,
]);
export type TokenizeCardResponse = z.infer<typeof TokenizeCardResponse>;

// CardElementsCheckoutRequest
export const CardElementsCheckoutRequest = z.object({
  session_id: z.string(),
  checkout_payment_method: CheckoutPaymentMethod,
  non_cde_form_fields: RequiredFormFields,
  do_not_use_legacy_cc_flow: z.boolean().optional(),
  existing_cc_pm_id: nullOrUndefOr(z.string()),
});
export type CardElementsCheckoutRequest = z.infer<typeof CardElementsCheckoutRequest>;

// SetupCheckoutRequest
export const SetupCheckoutRequest = z.object({
  session_id: z.string(),
  checkout_payment_method: CheckoutPaymentMethod,
  non_cde_form_fields: RequiredFormFields,
});
export type SetupCheckoutRequest = z.infer<typeof SetupCheckoutRequest>;
