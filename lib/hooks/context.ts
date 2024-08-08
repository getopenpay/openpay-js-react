import { createContext } from 'react';

export type ElementsContextValue = {
  contextId: string;
  formHeight: string;
  createToken: () => void;
  dispatchEvent: (event: MessageEvent, frame: HTMLIFrameElement) => void;
}

export const ElementsContext = createContext<ElementsContextValue>({
  contextId: '',
  formHeight: '',
  createToken: () => {},
  dispatchEvent: () => {},
});

export default { ElementsContext };
