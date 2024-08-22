import { ElementsStyle, AllFieldNames, PaymentRequestStatus } from './shared-models';

export type ElementProps = {
  styles?: ElementsStyle;
};

type ElementsFormChildrenProps = {
  submit: () => void;
  applePay: PaymentRequestStatus;
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
