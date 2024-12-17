import {
  PaymentRequest,
  PaymentRequestPaymentMethodEvent,
  StripeElements,
  StripeElementsOptionsMode,
  Stripe as StripeType,
  SetupIntentResult,
} from '@stripe/stripe-js';
import { CheckoutPaymentMethod, PaymentFlowStartedEventPayload } from './shared-models';
import { z } from 'zod';

export type StripeContext =
  | {
      isStripeAvailable: true;
      stripePubKey: string;
    }
  | {
      isStripeAvailable: false;
      stripePubKey: undefined;
    };

export const Stripe3DSNextActionMetadata = z.object({
  stripe_pk: z.string(),
  client_secret: z.string(),
  stripe_pm_id: z.string(),
});
export type Stripe3DSNextActionMetadata = z.infer<typeof Stripe3DSNextActionMetadata>;

export const PaymentRequestNextActionMetadata = z.object({
  type: z.string(),
  client_secret: z.string(),
  stripe_pk: z.string(),
});
export type PaymentRequestNextActionMetadata = z.infer<typeof PaymentRequestNextActionMetadata>;

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
  elementsOptions: StripeElementsOptionsMode
): Promise<{ elements: StripeElements; stripe: StripeType }> => {
  const stripe = await getLoadedStripe(stripePubKey);
  return {
    elements: stripe.elements(elementsOptions),
    stripe,
  };
};

export const createStripePaymentRequest = async (
  stripePubKey: string,
  totalAmountAtom: number,
  currency: string,
  isAmountPending?: boolean,
  isLinkOnly?: boolean
): Promise<PaymentRequest> => {
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

export const confirmPaymentFlowForStripePRLegacy = async (
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

export const confirmStripePrPM = async (
  nextActionMetadata: PaymentRequestNextActionMetadata,
  stripePm: PaymentRequestPaymentMethodEvent
): Promise<SetupIntentResult> => {
  if (!nextActionMetadata.stripe_pk || !nextActionMetadata.client_secret) {
    throw new Error(`Invalid next action metadata format: ${JSON.stringify(nextActionMetadata)}`);
  }
  const stripe = await getLoadedStripe(nextActionMetadata.stripe_pk);
  const confirmResult = await stripe.confirmCardSetup(nextActionMetadata.client_secret, {
    payment_method: stripePm.paymentMethod.id,
  });
  if (confirmResult.error) {
    stripePm.complete('fail');
    throw new Error(`Payment failed: ${confirmResult.error.message ?? `unknown`}`);
  } else {
    stripePm.complete('success');
  }
  return confirmResult;
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
  const nextActionMetadata = Stripe3DSNextActionMetadata.parse(payload.nextActionMetadata);
  await launchStripe3DSDialogFlow(nextActionMetadata);
};

export const launchStripe3DSDialogFlow = async (nextActionMetadata: Stripe3DSNextActionMetadata): Promise<void> => {
  const stripe = await getLoadedStripe(nextActionMetadata.stripe_pk);
  const confirmResult = await stripe.confirmCardSetup(nextActionMetadata.client_secret, {
    payment_method: nextActionMetadata.stripe_pm_id,
  });
  const resultStatus = confirmResult.setupIntent?.status;
  if (resultStatus === 'succeeded') {
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
