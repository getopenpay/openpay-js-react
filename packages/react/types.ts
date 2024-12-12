import { ElementsFormChildrenProps, FormCallbacks } from '@getopenpay/utils';
import { CustomInitParams } from '@getopenpay/utils/src/flows/ojs-flow';

// Type defined separately from ElementsFormProps to be more explicit
export type ElementsFormPropsReact = {
  className?: string;
  checkoutSecureToken: string;
  baseUrl?: string;
  formTarget?: string;
  customInitParams?: CustomInitParams;
  children: (props: ElementsFormChildrenProps) => JSX.Element;
} & FormCallbacks;
