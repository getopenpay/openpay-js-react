import { createContext } from 'react';

export type ElementsContextValue = {
  formId: string;
  formHeight: string;
  referer?: string;
  checkoutSecureToken?: string;
  registerIframe: (iframe: HTMLIFrameElement) => void;
  baseUrl: string;
};

export const ElementsContext = createContext<ElementsContextValue>({
  formId: '',
  formHeight: '',
  referer: undefined,
  checkoutSecureToken: undefined,
  registerIframe: () => {},
  baseUrl: '',
});

export default { ElementsContext };
