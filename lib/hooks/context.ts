import { createContext } from 'react';

export type ElementsContextValue = {
  contextId: string;
  createToken: () => void;
  dispatchEvent: (event: MessageEvent, frame: HTMLIFrameElement) => void;
  formHeight: string;
}

export const ElementsContext = createContext<ElementsContextValue>({
  contextId: '',
  createToken: () => {},
  dispatchEvent: () => {},
  formHeight: '',
});

export default { ElementsContext };
