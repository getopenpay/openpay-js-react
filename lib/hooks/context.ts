import { createContext } from 'react';

export type ElementsContextValue = {
  contextId: string;
  referer?: string;
  checkoutSecureToken?: string;
  formHeight: string;
  createToken: () => void;
  dispatchEvent: (event: MessageEvent, frame: HTMLIFrameElement) => void;
};

export const ElementsContext = createContext<ElementsContextValue>({
  contextId: '',
  formHeight: '',
  referer: undefined,
  checkoutSecureToken: undefined,
  createToken: () => {},
  dispatchEvent: () => {},
});

export default { ElementsContext };
