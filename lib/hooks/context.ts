import { createContext } from 'react';

export type ElementsContextValue = {
  formId: string;
  formHeight: string;
  referer?: string;
  checkoutSecureToken?: string;
};

export const ElementsContext = createContext<ElementsContextValue>({
  formId: '',
  formHeight: '',
  referer: undefined,
  checkoutSecureToken: undefined,
});

export default { ElementsContext };
