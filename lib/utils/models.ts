import { ElementsStyle, FieldName } from './shared-models';

export type ElementProps = {
  styles?: ElementsStyle;
};

type ElementsFormChildrenProps = {
  submit: () => void;
};

export type ElementsFormProps = {
  className?: string;
  checkoutSecureToken?: string;
  children: (props: ElementsFormChildrenProps) => JSX.Element;
  onFocus?: (elementId: string) => void;
  onBlur?: (elementId: string) => void;
  onChange?: (elementId: string) => void;
  onLoad?: (totalAmountAtoms: number) => void;
  onLoadError?: (message: string) => void;
  onValidationError?: (field: FieldName, errors: string[], elementId?: string) => void;
  onCheckoutStarted?: () => void;
  onCheckoutSuccess?: (invoiceUrls: string[]) => void;
  onCheckoutError?: (message: string) => void;
};
