import { ElementsStyle, AllFieldNames, PaymentRequestStatus, CardPlaceholder } from './shared-models';

type GenericElementStyle = Omit<ElementsStyle, 'placeholder'>;

export type ElementProps = {
  styles?: GenericElementStyle;
};

export type StandaloneElementProps = ElementProps & {
  styles?: GenericElementStyle & {
    placeholder?: string;
  };
};

export type InlineElementProps = ElementProps & {
  styles?: GenericElementStyle & {
    placeholder?: CardPlaceholder;
  };
};

export type ElementsFormChildrenProps = {
  submit: () => void;
  applePay: PaymentRequestStatus;
  googlePay: PaymentRequestStatus;
};

export type ElementsFormProps = {
  className?: string;
  checkoutSecureToken?: string;
  children: (props: ElementsFormChildrenProps) => JSX.Element;
  onFocus?: (elementId: string) => void;
  onBlur?: (elementId: string) => void;
  onChange?: (elementId: string) => void;
  onLoad?: (totalAmountAtoms: number, currency?: string) => void;
  onLoadError?: (message: string) => void;
  onValidationError?: (field: AllFieldNames, errors: string[], elementId?: string) => void;
  onCheckoutStarted?: () => void;
  onCheckoutSuccess?: (invoiceUrls: string[], subscriptionIds: string[], customerId: string) => void;
  onCheckoutError?: (message: string) => void;
  baseUrl?: string;
};
