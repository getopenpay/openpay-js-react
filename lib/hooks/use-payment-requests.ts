import { createStripePaymentRequest, parseStripePubKey, waitForUserToAddPaymentMethod } from '../utils/stripe';
import {
  Amount,
  CheckoutPaymentMethod,
  EventType,
  FieldName,
  PaymentRequestStartParams,
  PaymentRequestStatus,
} from '../utils/shared-models';
import useMap from './use-map';
import useAsyncEffect from 'use-async-effect';
import { z } from 'zod';
import { PaymentRequestPaymentMethodEvent, PaymentRequest } from '@stripe/stripe-js';
import { constructSubmitEventPayload } from '../utils/event';
import { getErrorMessage } from '../utils/errors';
import { CdeConnection } from '../utils/cde-connection';
import { DynamicPreview, getCheckoutPreviewAmount } from './use-dynamic-preview';
import { useEffect, useState } from 'react';
import { getPrefill } from '../utils/cde-client';

const PaymentRequestProvider = z.enum(['apple_pay', 'google_pay', 'stripe_link']);
type PaymentRequestProvider = z.infer<typeof PaymentRequestProvider>;

const OUR_PROVIDER_TO_STRIPES: Record<PaymentRequestProvider, string> = {
  apple_pay: 'applePay',
  google_pay: 'googlePay',
  stripe_link: 'link', // TODO ASAP: check if 'link' is correct
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
    stripe_link: PR_LOADING,
  });
  const isLoading = secureToken === undefined || availableCPMs === undefined || !formDiv || !cdeConn;
  const previewAmount = dynamicPreview.amount;
  const [isSetupMode, setIsSetupMode] = useState<boolean | null>(null);

  // TODO: add more processors here once we have more processors supporting PaymentRequest API
  useEffect(() => {
    if (!hasGlobalPaymentRequest() || !previewAmount || isSetupMode === null) {
      return;
    }
    const pr = getGlobalPaymentRequest();
    updatePrWithAmount(pr, previewAmount, isSetupMode);
  }, [previewAmount, isSetupMode]);

  // Stripe-based Payment Requests
  useAsyncEffect(async () => {
    if (isLoading) {
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
    const prefill = await getPrefill(cdeConn);
    const isSetupMode = prefill.mode === 'setup';
    setIsSetupMode(isSetupMode);
    const initialPreview = await getCheckoutPreviewAmount(cdeConn, secureToken, isSetupMode, undefined);
    const pr = await createStripePaymentRequest(
      stripePubKey,
      initialPreview.amountAtom,
      initialPreview.currency,
      isSetupMode
    );
    setGlobalPaymentRequest(pr);
    const canMakePayment = await pr.canMakePayment();
    console.log('Can make payment?', canMakePayment);

    for (const provider of PaymentRequestProvider.options) {
      const providerFriendlyName = provider.replace('_', '');
      console.log(`Processing provider ${providerFriendlyName}`);
      try {
        setStatus.set(provider, {
          isLoading: false,
          isAvailable: canMakePayment?.[OUR_PROVIDER_TO_STRIPES[provider]] ?? false,
          startFlow: (params?: PaymentRequestStartParams) =>
            startPaymentRequestUserFlow(formDiv, stripeCpm, onUserCompleteUIFlow, onValidationError, onError, params),
        });
      } catch (e) {
        console.error(e);
        setStatus.set(provider, PR_ERROR);
      }
    }
  }, [isLoading]);

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
  onError: (errMsg: string) => void,
  params?: PaymentRequestStartParams
): Promise<void> => {
  try {
    const log = window.console.log;
    log('[startFlow] triggered');
    if (!validateFormFields(formDiv, onValidationError, stripeCpm)) {
      return;
    }
    log('[startFlow] post-validate');
    const pr = getGlobalPaymentRequest();
    log('[startFlow] pr:', pr, 'override:', params?.overridePaymentRequest);
    if (params?.overridePaymentRequest) {
      const override = params?.overridePaymentRequest;
      updatePrWithAmount(pr, override.amount, override.pending);
    }
    log('[startFlow] showing PR...');
    pr.show();
    log('[startFlow] PR shown. Waiting...');
    const pmAddedEvent = await waitForUserToAddPaymentMethod(pr);
    log('[startFlow] PR fulfilled. Completing flow...');
    onUserCompleteUIFlow(pmAddedEvent, stripeCpm);
  } catch (e) {
    window.console.error('[startFlow] Error:', e);
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

const hasGlobalPaymentRequest = (): boolean => {
  return 'ojs_pr' in window;
};

const getGlobalPaymentRequest = (): PaymentRequest => {
  if (!hasGlobalPaymentRequest()) {
    throw new Error('Global PR not set');
  }
  // @ts-expect-error window typing
  return window['ojs_pr'];
};

const updatePrWithAmount = (pr: PaymentRequest, amount: Amount, isPending: boolean): void => {
  pr.update({ total: { amount: amount.amountAtom, label: 'Total', pending: isPending }, currency: amount.currency });
};
