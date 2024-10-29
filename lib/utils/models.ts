import { z } from 'zod';
import { AllFieldNames, type ElementsStyle, PaymentRequestStatus } from './shared-models';
import { DynamicPreview } from '../hooks/use-dynamic-preview';

export type ElementProps<PlaceholderType extends z.ZodTypeAny = z.ZodString> = {
  styles?: ElementsStyle<z.ZodOptional<PlaceholderType>>;
};

export type ElementsFormChildrenProps = {
  submit: () => void;
  applePay: PaymentRequestStatus;
  googlePay: PaymentRequestStatus;
  stripeLink: {
    // button: FC<StripeLinkButtonProps>;
    // authElement: FC<LinkAuthElementProps>;
    pr: PaymentRequestStatus;
  };
  loaded: boolean;
  preview: DynamicPreview;
};

export type ElementsFormProps = {
  className?: string;
  checkoutSecureToken?: string;
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
};
