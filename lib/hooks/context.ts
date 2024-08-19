import { createContext } from 'react';
import { StripeContext } from '../utils/stripe';

export type ElementsContextValue = {
  formId: string;
  formHeight: string;
  referer?: string;
  checkoutSecureToken?: string;
  stripeContext: StripeContext | null;
  registerIframe: (iframe: HTMLIFrameElement) => void;
  baseUrl: string;
};

export const ElementsContext = createContext<ElementsContextValue>({
  formId: '',
  formHeight: '',
  referer: undefined,
  checkoutSecureToken: undefined,
  stripeContext: null,
  registerIframe: () => {},
  baseUrl: '',
});

export default { ElementsContext };
