import { createContext } from 'react';
import { Appearance } from '../utils/shared-models';

export type ElementsContextValue = {
  contextId: string;
  formHeight: string;
  referer?: string;
  checkoutSecureToken?: string;
  appearance?: Appearance;
};

export const ElementsContext = createContext<ElementsContextValue>({
  contextId: '',
  formHeight: '',
  referer: undefined,
  checkoutSecureToken: undefined,
});

export default { ElementsContext };
