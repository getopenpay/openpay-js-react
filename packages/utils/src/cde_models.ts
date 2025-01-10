import { z } from 'zod';
import { PRFormFields, RequiredFormFields } from './shared-models';

export const nullOrUndefOr = <T extends z.ZodType>(zType: T): z.ZodNullable<z.ZodOptional<T>> =>
  z.nullable(zType.optional());

export const zStringReq = z.string().trim().min(1, { message: `Cannot be blank` });

// CDEResponseError
export const CDEResponseError = z.object({
  cde_response_type: z.literal('error'),
  message: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type CDEResponseError = z.infer<typeof CDEResponseError>;

// CurrencyEnum
export const CurrencyEnum = z.enum(['usd', 'brl']);
export type CurrencyEnum = z.infer<typeof CurrencyEnum>;

// CouponMinimal
export const CouponMinimal = z.object({
  name: z.string(),
  amount_atom_off: nullOrUndefOr(z.number()),
  percent_off: nullOrUndefOr(z.number()),
  currency: nullOrUndefOr(z.string()),
  duration: z.string(),
  duration_in_months: nullOrUndefOr(z.number()),
});
export type CouponMinimal = z.infer<typeof CouponMinimal>;

// LineItem
export const LineItem = z.object({
  amount_subtotal_atom: z.number().int(),
  amount_total_atom: z.number().int(),
  currency: z.string(),
  description: nullOrUndefOr(z.string()),
  price_id: z.string(),
  billing_interval: nullOrUndefOr(z.string()),
  billing_interval_count: nullOrUndefOr(z.number().int()),
  quantity: z.number().int(),
});
export type LineItem = z.infer<typeof LineItem>;

// BrandSettings
export const BrandSettings = z.record(z.string(), z.any());
export type BrandSettings = z.infer<typeof BrandSettings>;

// Brand
export const Brand = z.object({
  name: z.string(),
  settings: nullOrUndefOr(BrandSettings),
});
export type Brand = z.infer<typeof Brand>;

// CheckoutPaymentMethod
export const CheckoutPaymentMethod = z.object({
  provider: z.string(),
  processor_name: nullOrUndefOr(z.string()),
  metadata: nullOrUndefOr(z.record(z.string(), z.any())),
});
export type CheckoutPaymentMethod = z.infer<typeof CheckoutPaymentMethod>;

// SubscriptionItemMinimal
export const SubscriptionItemMinimal = z.object({
  quantity: z.number(),
});
export type SubscriptionItemMinimal = z.infer<typeof SubscriptionItemMinimal>;

// SubscriptionMinimal
export const SubscriptionMinimal = z.object({
  id: nullOrUndefOr(z.string()),
  billing_interval: nullOrUndefOr(z.string()),
  billing_interval_count: nullOrUndefOr(z.number().int()),
  subscription_items: z.array(SubscriptionItemMinimal),
  trial_start: nullOrUndefOr(z.string()),
  trial_end: nullOrUndefOr(z.string()),
});
export type SubscriptionMinimal = z.infer<typeof SubscriptionMinimal>;

// InvoiceItemDiscountAmountsMinimal
export const InvoiceItemDiscountAmountsMinimal = z.object({
  amount_atom: z.number(),
});
export type InvoiceItemDiscountAmountsMinimal = z.infer<typeof InvoiceItemDiscountAmountsMinimal>;

// InvoiceLineItemMinimal
export const InvoiceLineItemMinimal = z.object({
  amount_atom: z.number(),
  amount_atom_considering_discount_applied: z.number(),
  currency: z.string(),
  discount_amount_atoms: z.array(InvoiceItemDiscountAmountsMinimal),
  subscription_item_id: z.string(),
});
export type InvoiceLineItemMinimal = z.infer<typeof InvoiceLineItemMinimal>;

export const DiscountMinimal = z.object({
  coupon: CouponMinimal,
});
export type DiscountMinimal = z.infer<typeof DiscountMinimal>;

// InvoiceMinimal
export const InvoiceMinimal = z.object({
  currency: z.string(),
  discounts: z.array(DiscountMinimal),
  hosted_invoice_url: nullOrUndefOr(z.string()),
  lines: z.array(InvoiceLineItemMinimal),
  remaining_amount_atom: z.number(),
  tax_amount_atom: z.number(),
  total_amount_atom: z.number(),
  total_discount_amount_atoms: z.array(InvoiceItemDiscountAmountsMinimal),
});
export type InvoiceMinimal = z.infer<typeof InvoiceMinimal>;

// CreateSubscriptionResponseMinimal
export const CreateSubscriptionResponseMinimal = z.object({
  created: z.array(SubscriptionMinimal),
  invoices: z.array(InvoiceMinimal),
});
export type CreateSubscriptionResponseMinimal = z.infer<typeof CreateSubscriptionResponseMinimal>;

// PreviewCheckoutResponse
export const PreviewCheckoutResponse = z.object({
  preview: CreateSubscriptionResponseMinimal,
  preview_post_trial: nullOrUndefOr(CreateSubscriptionResponseMinimal),
  coupons: z.array(CouponMinimal),
});
export type PreviewCheckoutResponse = z.infer<typeof PreviewCheckoutResponse>;

// PaymentFormPrefill
const _PaymentFormPrefillCommon = z.object({
  status: z.literal('open'),
  token: z.string(),
  email: nullOrUndefOr(z.string()),
  line_items: z.array(LineItem),
  amount_subtotal_atom: z.number().int(),
  amount_total_atom: z.number().int(),
  brand: Brand,
  subs_preview: nullOrUndefOr(PreviewCheckoutResponse), // Null in setup mode
  methods_available: z.array(CheckoutPaymentMethod),
});
export const PaymentFormPrefill = z.discriminatedUnion('mode', [
  z
    .object({
      mode: z.literal('setup'),
      currency: z.nullable(z.undefined()),
    })
    .extend(_PaymentFormPrefillCommon.shape),
  z
    .object({
      mode: z.enum(['payment', 'subscription']),
      currency: z.string(),
    })
    .extend(_PaymentFormPrefillCommon.shape),
]);
export type PaymentFormPrefill = z.infer<typeof PaymentFormPrefill>;

// CompletedFormPrefill
export const CompletedFormPrefill = z.object({
  status: z.literal('complete'),
});
export type CompletedFormPrefill = z.infer<typeof CompletedFormPrefill>;

// ExpiredFormPrefill
export const ExpiredFormPrefill = z.object({
  status: z.literal('expired'),
});
export type ExpiredFormPrefill = z.infer<typeof ExpiredFormPrefill>;

// PagePrefill
export const PagePrefill = z.union([PaymentFormPrefill, CompletedFormPrefill, ExpiredFormPrefill]);
export type PagePrefill = z.infer<typeof PagePrefill>;

// Theme
export const Theme = z.object({
  logo: z.string(),
  icon: z.string(),
  primary_color: z.string(),
  secondary_color: z.string(),
});
export type Theme = z.infer<typeof Theme>;

// CheckoutSuccessResponse
export const CheckoutSuccessResponse = z.object({
  invoice_urls: z.array(z.string()),
  subscription_ids: z.array(z.string()),
  customer_id: z.string(),
});
export type CheckoutSuccessResponse = z.infer<typeof CheckoutSuccessResponse>;

// FinalizeSetupPaymentMethodRequest
export const FinalizeSetupPaymentMethodRequest = z.object({
  secure_token: z.string(),
  pm_id: z.string(),
});
export type FinalizeSetupPaymentMethodRequest = z.infer<typeof FinalizeSetupPaymentMethodRequest>;

// CheckoutRequest
export const CheckoutRequest = z.object({
  secure_token: z.string(),
  payment_input: z.any(), // Should follow AnyPaymentInput from CDE
  customer_email: z.string(),
  customer_zip_code: z.string(),
  customer_country: z.string(),
  line_items: z.array(LineItem),
  total_amount_atom: z.number().int(),
  cancel_at_end: z.boolean(),
  checkout_payment_method: CheckoutPaymentMethod,
  promotion_code: z.string().optional(),
  do_not_use_legacy_cc_flow: z.boolean().optional(),
  use_confirmed_pm_id: nullOrUndefOr(z.string()),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequest>;

export const SetupCheckoutResponse = z.object({
  payment_method_id: z.string(),
});
export type SetupCheckoutResponse = z.infer<typeof SetupCheckoutResponse>;

// CreditCardCreationResponse
export const CreditCardCreationResponse = z.object({
  id: z.string(),
  return_url: z.string(),
});
export type CreditCardCreationResponse = z.infer<typeof CreditCardCreationResponse>;

// PydanticValidationError
export const PydanticValidationError = z.object({
  type: z.string(),
  loc: z.array(z.string()),
  msg: z.string(),
  url: z.string(),
});
export type PydanticValidationError = z.infer<typeof PydanticValidationError>;

// PydanticValidationErrorResponse
export const PydanticValidationErrorResponse = z.array(PydanticValidationError);
export type PydanticValidationErrorResponse = z.infer<typeof PydanticValidationErrorResponse>;

// NewCustomerFields
export const NewCustomerFields = z.object({
  new_customer_email: z.string().optional(),
  new_customer_address: z.record(z.string(), z.any()).optional(),
  new_customer_first_name: z.string().optional(),
  new_customer_last_name: z.string().optional(),
});
export type NewCustomerFields = z.infer<typeof NewCustomerFields>;

// StartPaymentFlowRequest
export const PaymentMethodData = z.object({
  payment_method_data: z.record(z.string(), z.any()).optional(),
});
export type PaymentMethodData = z.infer<typeof PaymentMethodData>;

// StartPaymentFlowRequest
export const StartPaymentFlowRequest = z
  .object({
    payment_provider: z.string(),
    checkout_payment_method: CheckoutPaymentMethod,
    existing_cc_pm_id: z.string().optional(),
    their_existing_pm_id: z.string().optional(),
  })
  .extend(NewCustomerFields.shape)
  .extend(PaymentMethodData.shape);
export type StartPaymentFlowRequest = z.infer<typeof StartPaymentFlowRequest>;

// StartPaymentFlowResponse
export const StartPaymentFlowResponse = z.object({
  required_user_actions: z.array(z.record(z.string(), z.any())),
});
export type StartPaymentFlowResponse = z.infer<typeof StartPaymentFlowResponse>;

// StartPaymentFlowForPRRequest
export const StartPaymentFlowForPRRequest = z.object({
  fields: PRFormFields,
  checkoutPaymentMethod: CheckoutPaymentMethod,
});
export type StartPaymentFlowForPRRequest = z.infer<typeof StartPaymentFlowForPRRequest>;

// StartPaymentFlowForCCRequest
export const StartPaymentFlowForCCRequest = z.object({
  session_id: z.string(),
  non_cde_form_fields: RequiredFormFields,
  checkout_payment_method: CheckoutPaymentMethod,
  extra_metadata: z.record(z.string(), z.any()), // This is optional in CDE, but not in OJS moving forward
});
export type StartPaymentFlowForCCRequest = z.infer<typeof StartPaymentFlowForCCRequest>;

// StartPaymentFlowForCCResponse
export const StartPaymentFlowForCCResponse = z.object({
  required_user_actions: z.array(z.record(z.string(), z.any())),
  cc_pm_id: z.string(),
});
export type StartPaymentFlowForCCResponse = z.infer<typeof StartPaymentFlowForCCResponse>;

// GenericNextActionMetadata
export const GenericNextActionMetadata = z.record(z.any());
export type GenericNextActionMetadata = z.infer<typeof GenericNextActionMetadata>;

export const GetProcessorAccountRequest = z.object({
  checkout_secure_token: z.string(),
  checkout_payment_method: CheckoutPaymentMethod,
});
export type GetProcessorAccountRequest = z.infer<typeof GetProcessorAccountRequest>;

export const GetProcessorAccountResponse = z.object({
  id: z.string(),
  created_at: z.string(),
  identifier: z.string(),
  nickname: z.string().optional(),
  status: z.string(),
  view_type: z.string().optional(),
  account_details: z.record(z.string(), z.any()).optional(),
  customer_agreements: z.record(z.string(), z.any()).optional(),
  primary_contact: z.record(z.string(), z.any()).optional(),
  requirements: z.record(z.string(), z.any()).optional(),
  next_action: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type GetProcessorAccountResponse = z.infer<typeof GetProcessorAccountResponse>;

export const StartPaymentSessionRequest = z.object({
  checkout_secure_token: z.string(),
  checkout_payment_method: CheckoutPaymentMethod,
  validation_url: z.string(),
  payment_intent_id: z.string(),
  initiative_context: z.string(),
  their_account_id: z.string(),
});
export type StartPaymentSessionRequest = z.infer<typeof StartPaymentSessionRequest>;

export const StartPaymentSessionResponse = z.object({
  epochTimestamp: z.number(),
  expiresAt: z.number(),
  merchantIdentifier: z.string(),
  merchantSessionIdentifier: z.string(),
  nonce: z.string(),
  signature: z.string(),
});
export type StartPaymentSessionResponse = z.infer<typeof StartPaymentSessionResponse>;
