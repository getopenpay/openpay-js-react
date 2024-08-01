import { createContext } from 'react';

export type ElementsContextValue = {
  createToken: () => void;
}

export const ElementsContext = createContext<ElementsContextValue>({
  createToken: () => {},
});

export default { ElementsContext };
