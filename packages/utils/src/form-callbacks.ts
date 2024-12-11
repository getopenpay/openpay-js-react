import { AllFieldNames, PRStatuses } from '@getopenpay/utils';
import { z } from 'zod';

// 💡 Note: when creating new callbacks, please add them to both these types:
//   - FormCallbacks
//   - ZodFormCallbacks

export type FormCallbacks = {
  onFocus?: (elementId: string, field: AllFieldNames) => void;
  onBlur?: (elementId: string, field: AllFieldNames) => void;
  onChange?: (elementId: string, field: AllFieldNames, errors?: string[]) => void;
  onLoad?: (totalAmountAtoms?: number, currency?: string) => void;
  onLoadError?: (message: string) => void;
  onValidationError?: (field: AllFieldNames, errors: string[], elementId?: string) => void;
  onCheckoutStarted?: () => void;
  onCheckoutSuccess?: (invoiceUrls: string[], subscriptionIds: string[], customerId: string) => void;
  onSetupPaymentMethodSuccess?: (paymentMethodId: string) => void;
  onCheckoutError?: (message: string) => void;
  onPaymentRequestLoad?: (paymentRequests: PRStatuses) => void;
};

const OptionalFn = z.function().optional();

export const ZodFormCallbacks = z.object({
  onFocus: OptionalFn,
  onBlur: OptionalFn,
  onChange: OptionalFn,
  onLoad: OptionalFn,
  onLoadError: OptionalFn,
  onValidationError: OptionalFn,
  onCheckoutStarted: OptionalFn,
  onCheckoutSuccess: OptionalFn,
  onSetupPaymentMethodSuccess: OptionalFn,
  onCheckoutError: OptionalFn,
  onPaymentRequestLoad: OptionalFn,
});
export type ZodFormCallbacks = z.infer<typeof ZodFormCallbacks>;

export const parseFormCallbacks = (obj: unknown): FormCallbacks => {
  const zodFormCallbacks: ZodFormCallbacks = ZodFormCallbacks.parse(obj);
  return zodFormCallbacks;
};
