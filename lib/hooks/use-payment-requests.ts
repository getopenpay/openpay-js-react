import { createStripePaymentRequest, parseStripePubKey, waitForUserToAddPaymentMethod } from '../utils/stripe';
import { CheckoutPaymentMethod, EventType, FieldName, PaymentRequestStatus } from '../utils/shared-models';
import useMap from './use-map';
import useAsyncEffect from 'use-async-effect';
import { z } from 'zod';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';
import { constructSubmitEventPayload, createInputsDictFromForm } from '../utils/event';
import { getErrorMessage } from '../utils/errors';
import { CdeConnection } from '../utils/cde-connection';
import { getCheckoutPreview } from '../utils/cde-client';

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
  totalAmountAtom: number | undefined,
  currency: string | undefined,
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
  const isLoading =
    totalAmountAtom === undefined || currency === undefined || availableCPMs === undefined || !formDiv || !cdeConn;

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
        const DUMMY_AMOUNT_ATOM = 1000; // Just to check if PR is available
        const testerPR = await createStripePaymentRequest(stripePubKey, DUMMY_AMOUNT_ATOM, currency);
        const canMakePayment = await testerPR.canMakePayment();
        console.log(`- Can make payment? ${JSON.stringify(canMakePayment)}`);
        testerPR.abort();
        if (!canMakePayment) {
          throw new Error(`Cannot make payment with ${providerFriendlyName} for this session`);
        }
        // Callback when payment request is finished
        const startPaymentRequestUserFlow = async (): Promise<void> => {
          try {
            createInputsDictFromForm(formDiv, {});
            if (onValidationError) {
              // TODO refactor validation out of this construct function later
              const startPaymentFlowEvent = constructSubmitEventPayload(
                EventType.enum.START_PAYMENT_FLOW,
                // This is ok since we're just calling this function to use the validation function inside it
                'dummy',
                formDiv,
                onValidationError,
                stripeXPrCpm,
                false
              );
              if (!startPaymentFlowEvent) return;
            }
            // if (validTarget === null) {
            //   throw new Error(`Submit called while elements are not fully loaded yet.`);
            // }
            // console.log(eventTargets);
            // for (const evtTgt of eventTargets) {
            //   try {
            //     await getCheckoutPreview(evtTgt);
            //   } catch (e) {
            //     console.error('next');
            //   }
            // }
            // const checkoutPreview = await getCheckoutPreview(eventTargets[0]);
            // console.log('Checkout preview', checkoutPreview);
            await getCheckoutPreview(cdeConn);
            const x = 1;
            if (x + 1 === 2) {
              throw new Error('Pause');
            }
            const realAmountAtom = 0; // TODO ASAP get checkout preview here
            const pr = await createStripePaymentRequest(stripePubKey, realAmountAtom, currency);
            await pr.canMakePayment(); // Required
            pr.show();
            const pmAddedEvent = await waitForUserToAddPaymentMethod(pr);
            onUserCompleteUIFlow(pmAddedEvent, stripeXPrCpm);
          } catch (e) {
            console.error(e);
            onError(getErrorMessage(e));
          }
        };
        setStatus.set(provider, {
          isLoading: false,
          isAvailable: canMakePayment[OUR_PROVIDER_TO_STRIPES[provider]],
          startFlow: startPaymentRequestUserFlow,
        });
      } catch (e) {
        console.error(e);
        setStatus.set(provider, PR_ERROR);
      }
    }
  }, [isLoading, availableCPMs]);

  return status;
};
