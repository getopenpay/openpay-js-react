import { Appearance, ElementsStyle } from './shared-models';

export type ElementProps = {
  styles?: ElementsStyle;
};

type ElementsFormChildrenProps = {
  submit: () => void;
};

export type ElementsFormProps = {
  className?: string;
  appearance?: Appearance;
  checkoutSecureToken?: string;
  children: (props: ElementsFormChildrenProps) => JSX.Element;
  onFocus?: (elementId: string) => void;
  onBlur?: (elementId: string) => void;
  onChange?: (elementId: string) => void;
  onLoad?: (totalAmountAtoms: number) => void;
  onLoadError?: (message: string) => void;
  onValidationError?: (message: string, elementId?: string) => void;
  onCheckoutStarted?: () => void;
  onCheckoutSuccess?: (invoiceUrls: string[]) => void;
  onCheckoutError?: (message: string) => void;
};
