import {
  PaymentRequest,
  PaymentRequestPaymentMethodEvent,
  StripeElements,
  StripeElementsOptionsClientSecret,
  Stripe as StripeType,
} from '@stripe/stripe-js';
import { Amount, CheckoutPaymentMethod, PaymentFlowStartedEventPayload } from './shared-models';

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

const getLoadedStripe = async (publishableKey: string): Promise<StripeType> => {
  for (let i = 0; i < 10; i++) {
    if (!isStripeJsPresent()) {
      await sleep(500);
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

export const createStripeElements = async (
  stripePubKey: string,
  elementsOptions: StripeElementsOptionsClientSecret
): Promise<{ elements: StripeElements; stripe: StripeType }> => {
  const stripe = await getLoadedStripe(stripePubKey);
  return {
    elements: stripe.elements(elementsOptions),
    stripe,
  };
};

export const createElementsOptions = (amount: Amount): StripeElementsOptionsClientSecret => {
  console.log(amount);
  return {
    // TODO: uncomment these later if we decide to use elements
    // clientSecret: 'seti_1QCcXVKKXdhjXGwFhd0btSQD_secret_R4m53UhbceUDHVoxq07r2zoEgqJg7wd',
    // mode: 'payment',
    // amount: amount.amountAtom,
    // currency: amount.currency,
    // setup_future_usage: 'off_session',
  };
};

export const createStripePaymentRequest = async (
  stripePubKey: string,
  totalAmountAtom: number,
  currency: string,
  isAmountPending?: boolean,
  isLinkOnly?: boolean
): Promise<PaymentRequest> => {
  console.log(isLinkOnly);
  const stripe = await getLoadedStripe(stripePubKey);
  const stripeCurrency = ourCurrencyToTheirs[currency.toLowerCase().trim()];
  const paymentRequest = stripe.paymentRequest({
    // TODO: replace this with stripe account country as soon as we support it
    country: 'US',
    currency: stripeCurrency,
    total: {
      label: 'Total',
      amount: totalAmountAtom,
      pending: isAmountPending,
    },
    requestPayerName: true,
    requestPayerEmail: true,
    disableWallets: !isLinkOnly ? [] : ['applePay', 'browserCard', 'googlePay'],
  });

  return paymentRequest;
};

export const sleep = (timeoutMs: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
};

const isStripeJsPresent = (): boolean => {
  return 'Stripe' in window;
};

export const waitForUserToAddPaymentMethod = async (
  paymentRequest: PaymentRequest
): Promise<PaymentRequestPaymentMethodEvent> => {
  return new Promise((resolve, reject) => {
    try {
      paymentRequest.on('paymentmethod', async (evt) => {
        resolve(evt);
      });
      paymentRequest.on('cancel', () => {
        reject(new Error(`Payment cancelled, please click Submit again to pay`));
      });
    } catch (e) {
      reject(e);
    }
  });
};

export const parseStripePubKey = (cpmMetadata?: CheckoutPaymentMethod['metadata']): string => {
  const stripePubKey = cpmMetadata?.['stripe_pk'];
  if (typeof stripePubKey !== 'string') {
    throw new Error(`Invalid: stripe_pk not passed in checkout payment method`);
  }
  return stripePubKey;
};

export const confirmPaymentFlowForStripePR = async (
  payload: PaymentFlowStartedEventPayload,
  stripePm: PaymentRequestPaymentMethodEvent
): Promise<void> => {
  const nextActionMetadata = payload.nextActionMetadata;
  if (!payload.paymentFlowMetadata || !payload.paymentFlowMetadata['stripePmId']) {
    throw new Error(`Invalid payment flow metadata format: ${JSON.stringify(payload.paymentFlowMetadata)}`);
  }
  if (!nextActionMetadata.stripe_pk || !nextActionMetadata.client_secret) {
    throw new Error(`Invalid next action metadata format: ${JSON.stringify(nextActionMetadata)}`);
  }
  if (stripePm.paymentMethod.id !== payload.paymentFlowMetadata['stripePmId']) {
    throw new Error(`PM ID mismatch: ${stripePm.paymentMethod.id} != ${payload.paymentFlowMetadata['stripePmId']}`);
  }
  const stripe = await getLoadedStripe(nextActionMetadata.stripe_pk);
  const confirmResult = await stripe.confirmCardSetup(nextActionMetadata.client_secret, {
    payment_method: payload.paymentFlowMetadata['stripePmId'],
  });
  if (confirmResult.error) {
    stripePm.complete('fail');
    throw new Error(`Payment failed: ${confirmResult.error.message ?? `unknown`}`);
  } else {
    stripePm.complete('success');
  }
};

export const confirmPaymentFlowForStripeLink = async (payload: PaymentFlowStartedEventPayload): Promise<void> => {
  const nextActionMetadata = payload.nextActionMetadata;
  if (!nextActionMetadata.stripe_pk || !nextActionMetadata.client_secret) {
    throw new Error(`Invalid next action metadata format: ${JSON.stringify(nextActionMetadata)}`);
  }
  const { elements, stripe } = getGlobalStripeElements();
  await stripe.confirmSetup({
    elements,
    clientSecret: nextActionMetadata.client_secret,
    confirmParams: { return_url: window.location.href },
    redirect: 'if_required',
  });
};

export const confirmPaymentFlowFor3DS = async (payload: PaymentFlowStartedEventPayload): Promise<void> => {
  const nextActionMetadata = payload.nextActionMetadata;
  const stripe = await getLoadedStripe(nextActionMetadata.stripe_pk);
  const confirmResult = await stripe.confirmCardSetup(nextActionMetadata.client_secret, {
    payment_method: nextActionMetadata.stripe_pm_id,
  });
  const resultStatus = confirmResult.setupIntent?.status;
  if (resultStatus === 'succeeded') {
    // Nice
    console.log('[3DS] CONFIRMING PM:', nextActionMetadata.stripe_pm_id);
    console.log('[3DS] Setup intent created:', confirmResult.setupIntent);
  } else if (resultStatus === 'canceled') {
    throw new Error(`Payment cancelled, please click Submit again to pay`);
  } else {
    throw new Error(
      `${confirmResult.error?.message ?? confirmResult.setupIntent?.last_setup_error?.message ?? 'Payment failed, please click submit again to pay.'}`
    );
  }
};

export const setGlobalStripeElements = (
  elements: StripeElements,
  confirmListener: () => void,
  stripe: StripeType
): void => {
  if ('ojs_stripe_elements' in window) {
    throw new Error('Attempted to set stripe elements twice');
  }
  // @ts-expect-error window typing
  window['ojs_stripe_elements'] = elements;
  // @ts-expect-error window typing
  window['ojs_stripe_elements_confirm_listener'] = confirmListener;
  // @ts-expect-error window typing
  window['ojs_stripe'] = stripe;
};

export const hasGlobalStripeElements = (): boolean => {
  return 'ojs_stripe_elements' in window;
};

export const getGlobalStripeElements = (): {
  elements: StripeElements;
  confirmListener: () => void;
  stripe: StripeType;
} => {
  if (!hasGlobalStripeElements()) {
    throw new Error('Global Stripe Elements not set');
  }

  return {
    // @ts-expect-error window typing
    elements: window['ojs_stripe_elements'],
    // @ts-expect-error window typing
    confirmListener: window['ojs_stripe_elements_confirm_listener'],
    // @ts-expect-error window typing
    stripe: window['ojs_stripe'],
  };
};
