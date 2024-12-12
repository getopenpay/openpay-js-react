import { ElementTypeEnum } from '@getopenpay/utils';
import { createContext } from 'react';

export type ElementsContextValue = {
  formId: string;
  formHeight: string;
  referrer?: string;
  checkoutSecureToken?: string;
  registerIframe: (type: ElementTypeEnum, iframe: HTMLIFrameElement) => void;
  baseUrl: string;
};

export const ElementsContext = createContext<ElementsContextValue>({
  formId: '',
  formHeight: '',
  referrer: undefined,
  checkoutSecureToken: undefined,
  registerIframe: () => {},
  baseUrl: '',
});

export default { ElementsContext };
