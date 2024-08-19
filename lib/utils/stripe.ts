import { PaymentRequest, Stripe as StripeType } from '@stripe/stripe-js';
import { LoadedEventPayload } from './shared-models';

export type StripeContext =
  | {
      isStripeAvailable: true;
      stripePubKey: string;
    }
  | {
      isStripeAvailable: false;
      stripePubKey: undefined;
    };

const ourCurrencyToTheirs: Record<string, string> = {
  usd: 'usd',
  brl: 'brl',
};

export const createStripeContext = (loadedEvent: LoadedEventPayload): StripeContext | null => {
  if (loadedEvent.stripePubKey === null) {
    return { isStripeAvailable: false, stripePubKey: undefined };
  }
  return { isStripeAvailable: true, stripePubKey: loadedEvent.stripePubKey };
};

const getLoadedStripe = (publishableKey: string): StripeType => {
  for (let i = 0; i < 10; i++) {
    if (!isStripeJsPresent()) {
      sleep(200);
    }
  }
  if (!isStripeJsPresent()) {
    console.log('Stripe JS not found.');
    throw new Error(`Stripe JS not found.`);
  }
  // @ts-expect-error Stripe is only used as a type here
  const stripe: StripeType = new Stripe(publishableKey);
  return stripe;
};

export const createStripePaymentRequest = async (
  stripePubKey: string,
  totalAmountAtom: number,
  currency: string
): Promise<PaymentRequest> => {
  const stripe = getLoadedStripe(stripePubKey);
  const stripeCurrency = ourCurrencyToTheirs[currency];
  const paymentRequest = stripe.paymentRequest({
    // TODO: replace this with stripe account country as soon as we support it
    country: 'US',
    currency: stripeCurrency,
    total: {
      label: 'Total',
      amount: totalAmountAtom,
    },
    requestPayerName: true,
    requestPayerEmail: true,
  });

  return paymentRequest;
};

const sleep = (timeoutMs: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
};

const isStripeJsPresent = (): boolean => {
  return 'Stripe' in window;
};
