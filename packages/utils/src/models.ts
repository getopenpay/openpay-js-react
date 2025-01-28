import { z } from 'zod';
import { AllFieldNames, Amount, type ElementsStyle, PaymentRequestStatus } from './shared-models';
import { CustomInitParams } from './flows/ojs-flow';
import { StripeLinkController } from './flows/stripe/stripe-link-flow';
import { InitGooglePayFlowResult } from './flows/airwallex/types/google-pay.types';
import { InitApplePayFlowResult } from './flows/airwallex/types/apple-pay.types';

export type DynamicPreview = {
  amount: Amount | null;
  isLoading: boolean;
  error: string | null;
};

export type ElementProps<PlaceholderType extends z.ZodTypeAny = z.ZodString> = {
  styles?: ElementsStyle<z.ZodOptional<PlaceholderType>>;
};

export type SubmitMethod = 'pockyt-paypal' | 'airwallex-google-pay' | 'airwallex-apple-pay';

export type ElementsFormChildrenProps = {
  submit: () => void;
  submitWith: (method: SubmitMethod) => void;
  applePay: PaymentRequestStatus;
  googlePay: PaymentRequestStatus;
  stripeLink: StripeLinkController | null;
  airwallex: {
    googlePay: InitGooglePayFlowResult | null;
    applePay: InitApplePayFlowResult | null;
  };
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
