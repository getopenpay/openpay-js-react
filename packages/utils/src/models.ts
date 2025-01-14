import { z } from 'zod';
import { AllFieldNames, Amount, type ElementsStyle, PaymentRequestStatus } from './shared-models';
import { CustomInitParams } from './flows/ojs-flow';
import { StripeLinkController } from './flows/stripe/stripe-link-flow';

export type DynamicPreview = {
  amount: Amount | null;
  isLoading: boolean;
  error: string | null;
};

export type ElementProps<PlaceholderType extends z.ZodTypeAny = z.ZodString> = {
  styles?: ElementsStyle<z.ZodOptional<PlaceholderType>>;
};

type SubmitMethod = 'pockyt-paypal';

export type ElementsFormChildrenProps = {
  submit: () => void;
  submitWith: (method: SubmitMethod) => void;
  applePay: PaymentRequestStatus;
  googlePay: PaymentRequestStatus;
  stripeLink: StripeLinkController | null;
  loaded: boolean;
  preview: DynamicPreview;
};

export type ElementsFormProps = {
  className?: string;
  checkoutSecureToken: string;
  children: (props: ElementsFormChildrenProps) => JSX.Element;
  onFocus?: (elementId: string) => void;
  onBlur?: (elementId: string) => void;
  onChange?: (elementId: string) => void;
  onLoad?: (totalAmountAtoms?: number, currency?: string) => void;
  onLoadError?: (message: string) => void;
  onValidationError?: (field: AllFieldNames, errors: string[], elementId?: string) => void;
  onCheckoutStarted?: () => void;
  onCheckoutSuccess?: (invoiceUrls: string[], subscriptionIds: string[], customerId: string) => void;
  onSetupPaymentMethodSuccess?: (paymentMethodId: string) => void;
  onCheckoutError?: (message: string) => void;
  baseUrl?: string;
  enableDynamicPreviews?: boolean;
  customInitParams?: CustomInitParams;
};
