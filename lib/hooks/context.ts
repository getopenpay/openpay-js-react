import { createContext } from 'react';

export type ElementsContextValue = {
  contextId: string;
  formHeight: string;
  referer?: string;
  checkoutSecureToken?: string;
};

export const ElementsContext = createContext<ElementsContextValue>({
  contextId: '',
  formHeight: '',
  referer: undefined,
  checkoutSecureToken: undefined,
});

export default { ElementsContext };
