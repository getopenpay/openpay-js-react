import { createContext } from 'react';

export type ElementsContextValue = {
  contextId: string;
  createToken: () => void;
  dispatchEvent: (event: MessageEvent) => void;
}

export const ElementsContext = createContext<ElementsContextValue>({
  contextId: '',
  createToken: () => {},
  dispatchEvent: () => {},
});

export default { ElementsContext };
