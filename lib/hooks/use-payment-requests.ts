import { createStripePaymentRequest, parseStripePubKey, waitForUserToAddPaymentMethod } from '../utils/stripe';
import {
  CheckoutPaymentMethod,
  EventType,
  FieldName,
  OptionalString,
  PaymentRequestStatus,
} from '../utils/shared-models';
import useMap from './use-map';
import useAsyncEffect from 'use-async-effect';
import { z } from 'zod';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';
import { constructSubmitEventPayload, createInputsDictFromForm } from '../utils/event';
import { getErrorMessage } from '../utils/errors';
import { CdeConnection } from '../utils/cde-connection';
import { getCheckoutPreview, getPrefill } from '../utils/cde-client';
import { sum } from '../utils/math';

const PaymentRequestProvider = z.enum(['apple_pay', 'google_pay']);
type PaymentRequestProvider = z.infer<typeof PaymentRequestProvider>;

const OUR_PROVIDER_TO_STRIPES: Record<PaymentRequestProvider, string> = {
  apple_pay: 'applePay',
  google_pay: 'googlePay',
};

const PR_LOADING: PaymentRequestStatus = {
  isLoading: true,
  isAvailable: false,
  startFlow: () => {
    console.warn(
      `startFlow triggered while payment request is still not ready. 
      You can check the ".isLoading" param to know when a payment request is still loading, 
      and ".isAvailable" to know if a payment request is available.`
    );
  },
};

const PR_ERROR: PaymentRequestStatus = {
  isLoading: false,
  isAvailable: false,
  startFlow: () => {
    console.error(`startFlow triggered when payment request is not available.`);
  },
};

export const usePaymentRequests = (
  cdeConn: CdeConnection | null,
  secureToken: string | undefined,
  availableCPMs: CheckoutPaymentMethod[] | undefined,
  formDiv: HTMLDivElement | null,
  onUserCompleteUIFlow: (
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ) => void,
  onValidationError: undefined | ((field: FieldName, errors: string[], elementId?: string) => void),
  onError: (errMsg: string) => void
): Record<PaymentRequestProvider, PaymentRequestStatus> => {
  const [status, setStatus] = useMap<Record<PaymentRequestProvider, PaymentRequestStatus>>({
    apple_pay: PR_LOADING,
    google_pay: PR_LOADING,
  });
  const isLoading = secureToken === undefined || availableCPMs === undefined || !formDiv || !cdeConn;

  // TODO: add more processors here once we have more processors supporting PaymentRequest API

  // Stripe-based Payment Requests
  useAsyncEffect(async () => {
    if (isLoading) {
      // Do nothing
      return;
    }
    for (const provider of PaymentRequestProvider.options) {
      const providerFriendlyName = provider.replace('_', '');
      console.log(`Processing provider ${providerFriendlyName}`);
      try {
        const stripeXPrCpm = availableCPMs.find((cpm) => cpm.provider === provider && cpm.processor_name === 'stripe');
        if (!stripeXPrCpm) {
          throw new Error(`${providerFriendlyName} is not available as a checkout method`);
        }
        const stripePubKey = parseStripePubKey(stripeXPrCpm.metadata);
        const isAvailable = await checkIfProviderIsAvailable(stripePubKey, provider);
        setStatus.set(provider, {
          isLoading: false,
          isAvailable,
          startFlow: () =>
            startPaymentRequestUserFlow(
              cdeConn,
              secureToken,
              formDiv,
              stripeXPrCpm,
              stripePubKey,
              onUserCompleteUIFlow,
              onValidationError,
              onError
            ),
        });
      } catch (e) {
        console.error(e);
        setStatus.set(provider, PR_ERROR);
      }
    }
  }, [isLoading, availableCPMs]);

  return status;
};

const getCheckoutValue = async (
  cdeConn: CdeConnection,
  secureToken: string,
  promoCode: string | undefined
): Promise<{ currency: string; amountAtom: number }> => {
  const checkoutPreview = await getCheckoutPreview(cdeConn, {
    secure_token: secureToken,
    promotion_code: promoCode,
  });
  const currencies = new Set(checkoutPreview.preview.invoices.map((inv) => inv.currency));
  if (currencies.size !== 1) {
    throw new Error(`Expected exactly one currency, got ${currencies.size}`);
  }
  const currency = currencies.values().next().value;
  const amountAtom = sum(checkoutPreview.preview.invoices.map((inv) => inv.remaining_amount_atom));
  return {
    currency,
    amountAtom,
  };
};

const checkIfProviderIsAvailable = async (stripePubKey: string, provider: PaymentRequestProvider): Promise<boolean> => {
  const DUMMY_AMOUNT_ATOM = 1000; // Just to check if PR is available
  const testerPR = await createStripePaymentRequest(stripePubKey, DUMMY_AMOUNT_ATOM, 'usd');
  const canMakePayment = await testerPR.canMakePayment();
  testerPR.abort();
  if (!canMakePayment) {
    throw new Error(`Cannot make payment with ${provider} for this session`);
  }
  return canMakePayment[OUR_PROVIDER_TO_STRIPES[provider]];
};

const validateFormFields = (
  formDiv: HTMLDivElement,
  onValidationError: undefined | ((field: FieldName, errors: string[], elementId?: string) => void),
  stripeXPrCpm: CheckoutPaymentMethod
): boolean => {
  // TODO refactor validation out of this construct function later
  const startPaymentFlowEvent = constructSubmitEventPayload(
    EventType.enum.START_PAYMENT_FLOW,
    // This is ok since we're just calling this function to use the validation function inside it
    'dummy',
    formDiv,
    onValidationError ?? (() => {}),
    stripeXPrCpm,
    false
  );
  return !!startPaymentFlowEvent;
};

const startPaymentRequestUserFlow = async (
  cdeConn: CdeConnection,
  secureToken: string,
  formDiv: HTMLDivElement,
  stripeXPrCpm: CheckoutPaymentMethod,
  stripePubKey: string,
  onUserCompleteUIFlow: (
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ) => void,
  onValidationError: undefined | ((field: FieldName, errors: string[], elementId?: string) => void),
  onError: (errMsg: string) => void
): Promise<void> => {
  try {
    const prefill = await getPrefill(cdeConn);
    const formData = createInputsDictFromForm(formDiv, {});
    if (!validateFormFields(formDiv, onValidationError, stripeXPrCpm)) {
      return;
    }
    const isSetupMode = prefill.mode === 'setup';
    // TODO refactor this later
    let amountAtom: number;
    let currency: string;
    if (isSetupMode) {
      amountAtom = 0;
      currency = 'usd'; // TODO check later if there's a way to know this in advance
    } else {
      const promoCodeParsed = OptionalString.safeParse(formData[FieldName.PROMOTION_CODE]);
      if (!promoCodeParsed.success) {
        throw new Error(`Unknown promo code type: ${promoCodeParsed.error.message}`);
      }
      const checkoutPreview = await getCheckoutValue(cdeConn, secureToken, promoCodeParsed.data);
      amountAtom = checkoutPreview.amountAtom;
      currency = checkoutPreview.currency;
    }
    const pr = await createStripePaymentRequest(stripePubKey, amountAtom, currency);
    await pr.canMakePayment(); // Required
    pr.show();
    const pmAddedEvent = await waitForUserToAddPaymentMethod(pr);
    onUserCompleteUIFlow(pmAddedEvent, stripeXPrCpm);
  } catch (e) {
    console.error(e);
    onError(getErrorMessage(e));
  }
};
