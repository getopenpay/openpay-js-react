import { createStripePaymentRequest, parseStripePubKey, waitForUserToAddPaymentMethod } from '../utils/stripe';
import { CheckoutPaymentMethod, EventType, FieldName, PaymentRequestStatus } from '../utils/shared-models';
import useMap from './use-map';
import useAsyncEffect from 'use-async-effect';
import { z } from 'zod';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';
import { constructSubmitEventPayload, createInputsDictFromForm } from '../utils/event';
import { getErrorMessage } from '../utils/errors';

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
  const isLoading = totalAmountAtom === undefined || currency === undefined || availableCPMs === undefined || !formDiv;

  // TODO: add more processors here once we have more processors supporting PaymentRequest API

  // Stripe-based Payment Requests
  useAsyncEffect(async () => {
    if (isLoading) {
      // Do nothing
      return;
    }
    for (const provider of PaymentRequestProvider.options) {
      const providerFriendlyName = provider.replace('_', '');
      try {
        const stripeXPrCpm = availableCPMs.find((cpm) => cpm.provider === provider && cpm.processor_name === 'stripe');
        if (!stripeXPrCpm) {
          throw new Error(`${providerFriendlyName} is not available as a checkout method`);
        }
        const stripePubKey = parseStripePubKey(stripeXPrCpm.metadata);
        const pr = await createStripePaymentRequest(stripePubKey, totalAmountAtom, currency);
        const canMakePayment = await pr.canMakePayment();
        if (!canMakePayment) {
          throw new Error(`Cannot make payment with ${providerFriendlyName} for this session`);
        }
        // Callback when payment request is finished
        const startPaymentRequestUserFlow = async (): Promise<void> => {
          try {
            createInputsDictFromForm(formDiv, {});
            if (onValidationError) {
              const startPaymentFlowEvent = constructSubmitEventPayload(
                EventType.enum.START_PAYMENT_FLOW,
                'dummy',
                formDiv,
                onValidationError,
                stripeXPrCpm
              );
              if (!startPaymentFlowEvent) return;
            }
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
