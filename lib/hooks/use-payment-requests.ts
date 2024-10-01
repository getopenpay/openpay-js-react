import { createStripePaymentRequest, parseStripePubKey, waitForUserToAddPaymentMethod } from '../utils/stripe';
import { CheckoutPaymentMethod, EventType, FieldName, PaymentRequestStatus } from '../utils/shared-models';
import useMap from './use-map';
import useAsyncEffect from 'use-async-effect';
import { z } from 'zod';
import { PaymentRequestPaymentMethodEvent, PaymentRequest } from '@stripe/stripe-js';
import { constructSubmitEventPayload } from '../utils/event';
import { getErrorMessage } from '../utils/errors';
import { CdeConnection } from '../utils/cde-connection';
import { DynamicPreview } from './use-dynamic-preview';

const PaymentRequestProvider = z.enum(['apple_pay', 'google_pay']);
type PaymentRequestProvider = z.infer<typeof PaymentRequestProvider>;

const OUR_PROVIDER_TO_STRIPES: Record<PaymentRequestProvider, string> = {
  apple_pay: 'applePay',
  google_pay: 'googlePay',
};

const PR_LOADING: PaymentRequestStatus = {
  isLoading: true,
  isAvailable: false,
  startFlow: async () => {
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
  startFlow: async () => {
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
  onError: (errMsg: string) => void,
  dynamicPreview: DynamicPreview
): Record<PaymentRequestProvider, PaymentRequestStatus> => {
  const [status, setStatus] = useMap<Record<PaymentRequestProvider, PaymentRequestStatus>>({
    apple_pay: PR_LOADING,
    google_pay: PR_LOADING,
  });
  const isLoading = secureToken === undefined || availableCPMs === undefined || !formDiv || !cdeConn;

  // TODO: add more processors here once we have more processors supporting PaymentRequest API

  // Stripe-based Payment Requests
  useAsyncEffect(async () => {
    if (isLoading || !dynamicPreview.amount) {
      // Do nothing
      return;
    }

    const stripeCpm = availableCPMs.find(
      (cpm) =>
        cpm.processor_name === 'stripe' && PaymentRequestProvider.options.map((s) => String(s)).includes(cpm.provider)
    );
    if (!stripeCpm) {
      throw new Error(`Stripe is not available as a checkout method`);
    }
    const stripePubKey = parseStripePubKey(stripeCpm.metadata);
    const previewAmt = dynamicPreview.amount;
    const pr = await createStripePaymentRequest(stripePubKey, previewAmt.amountAtom, previewAmt.currency);
    setGlobalPaymentRequest(pr);
    const canMakePayment = await pr.canMakePayment();

    for (const provider of PaymentRequestProvider.options) {
      const providerFriendlyName = provider.replace('_', '');
      console.log(`Processing provider ${providerFriendlyName}`);
      try {
        setStatus.set(provider, {
          isLoading: false,
          isAvailable: canMakePayment?.[OUR_PROVIDER_TO_STRIPES[provider]] ?? false,
          startFlow: () =>
            startPaymentRequestUserFlow(formDiv, stripeCpm, onUserCompleteUIFlow, onValidationError, onError),
        });
      } catch (e) {
        console.error(e);
        setStatus.set(provider, PR_ERROR);
      }
    }
  }, [isLoading, !dynamicPreview.amount]);

  return status;
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
  formDiv: HTMLDivElement,
  stripeCpm: CheckoutPaymentMethod,
  onUserCompleteUIFlow: (
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ) => void,
  onValidationError: undefined | ((field: FieldName, errors: string[], elementId?: string) => void),
  onError: (errMsg: string) => void
): Promise<void> => {
  try {
    if (!validateFormFields(formDiv, onValidationError, stripeCpm)) {
      return;
    }
    const pr = getGlobalPaymentRequest();
    pr.show();
    const pmAddedEvent = await waitForUserToAddPaymentMethod(pr);
    onUserCompleteUIFlow(pmAddedEvent, stripeCpm);
  } catch (e) {
    console.error(e);
    onError(getErrorMessage(e));
  }
};

const setGlobalPaymentRequest = (pr: PaymentRequest): void => {
  if ('ojs_pr' in window) {
    throw new Error('Attempted to set global PR twice');
  }
  // @ts-expect-error window typing
  window['ojs_pr'] = pr;
};

const getGlobalPaymentRequest = (): PaymentRequest => {
  if (!('ojs_pr' in window)) {
    throw new Error('Global PR not set');
  }
  // @ts-expect-error window typing
  return window['ojs_pr'];
};
