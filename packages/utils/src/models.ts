import { z } from 'zod';
import { AllFieldNames, Amount, type ElementsStyle, FieldNameEnum, PaymentRequestStatus } from './shared-models';
import { CustomInitParams } from './flows/ojs-flow';
import { StripeLinkController } from './flows/stripe/stripe-link-flow';
import {
  AirwallexApplePayFlowCustomParams,
  AirwallexGooglePayFlowCustomParams,
  InitAirwallexApplePayFlowResult,
  InitAirwallexGooglePayFlowResult,
} from './flows/airwallex/airwallex-utils';
import { MobileWalletFlowCustomParams } from './flows/common/mobile-wallet-utils';

export type DynamicPreview = {
  amount: Amount | null;
  isLoading: boolean;
  error: string | null;
};

export type ElementProps<PlaceholderType extends z.ZodTypeAny = z.ZodString> = {
  styles?: ElementsStyle<z.ZodOptional<PlaceholderType>>;
};

export type SubmitMethod =
  | 'pockyt-paypal'
  | 'airwallex-google-pay'
  | 'airwallex-apple-pay'
  | 'authorize-net-google-pay'
  | 'authorize-net-apple-pay';

export type DefaultFieldValues = Partial<Record<FieldNameEnum, string>>;
export type SubmitSettings<T extends SubmitMethod = SubmitMethod> = {
  'pockyt-paypal': { defaultFieldValues?: DefaultFieldValues };
  'airwallex-google-pay': AirwallexGooglePayFlowCustomParams;
  'airwallex-apple-pay': AirwallexApplePayFlowCustomParams;
  'authorize-net-google-pay': MobileWalletFlowCustomParams;
  'authorize-net-apple-pay': MobileWalletFlowCustomParams;
}[T];

export type ElementsFormChildrenProps = {
  submit: () => void;
  submitWith: <T extends SubmitMethod>(method: T, settings?: SubmitSettings<T>) => void;
  applePay: PaymentRequestStatus;
  googlePay: PaymentRequestStatus;
  stripeLink: StripeLinkController | null;
  airwallex: {
    googlePay: InitAirwallexGooglePayFlowResult;
    applePay: InitAirwallexApplePayFlowResult;
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
