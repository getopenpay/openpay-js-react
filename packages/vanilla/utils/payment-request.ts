import {
  CheckoutPaymentMethod,
  PaymentRequestStatus,
  PaymentRequestStartParams,
  createStripePaymentRequest,
  parseStripePubKey,
  waitForUserToAddPaymentMethod,
  getPrefill,
  Amount,
  getErrorMessage,
  CdeConnection,
  FieldName,
  constructSubmitEventPayload,
  EventType,
  getCheckoutPreviewAmount,
  PaymentRequestProvider,
} from '@getopenpay/utils';
import { Config } from '../index';
import { PaymentRequestPaymentMethodEvent, PaymentRequest } from '@stripe/stripe-js';

const OUR_PROVIDER_TO_STRIPES: Record<PaymentRequestProvider, string> = {
  apple_pay: 'applePay',
  google_pay: 'googlePay',
};

export async function initializePaymentRequests(
  config: Config,
  checkoutPaymentMethods: CheckoutPaymentMethod[],
  cdeConn: CdeConnection,
  onUserCompleteUIFlow: (
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ) => void,
  onValidationError: ((field: FieldName, errors: string[], elementId?: string) => void) | undefined,
  onError: (errMsg: string) => void
): Promise<Record<PaymentRequestProvider, PaymentRequestStatus>> {
  const paymentRequests: Record<PaymentRequestProvider, PaymentRequestStatus> = {
    apple_pay: { isLoading: true, isAvailable: false, startFlow: async () => {} },
    google_pay: { isLoading: true, isAvailable: false, startFlow: async () => {} },
  };

  const allStripeCPMs = checkoutPaymentMethods.filter(
    (cpm) => cpm.processor_name === 'stripe' && PaymentRequestProvider.options.map(String).includes(cpm.provider)
  );

  if (allStripeCPMs.length === 0) {
    throw new Error('Stripe is not available as a checkout method');
  }

  const stripePubKey = parseStripePubKey(allStripeCPMs[0].metadata);
  const prefill = await getPrefill(cdeConn);
  const isSetupMode = prefill.mode === 'setup';

  const initialPreview = await getCheckoutPreviewAmount(cdeConn, config.checkoutSecureToken!, isSetupMode, undefined);
  const pr = await createStripePaymentRequest(
    stripePubKey,
    initialPreview.amountAtom,
    initialPreview.currency,
    isSetupMode
  );
  const linkPr = await createStripePaymentRequest(
    stripePubKey,
    initialPreview.amountAtom,
    initialPreview.currency,
    isSetupMode,
    true
  );
  setGlobalPaymentRequest(pr, linkPr);

  const canMakePayment = await pr.canMakePayment();
  await linkPr.canMakePayment();

  for (const provider of PaymentRequestProvider.options) {
    try {
      const cpm = allStripeCPMs.find((cpm) => cpm.provider === provider);
      const isAvailable = canMakePayment?.[OUR_PROVIDER_TO_STRIPES[provider]] ?? false;

      if (!cpm) {
        throw new Error(`${provider} is not available as a stripe checkout method`);
      }

      paymentRequests[provider] = {
        isLoading: false,
        isAvailable,
        startFlow: (params?: PaymentRequestStartParams) =>
          startPaymentRequestUserFlow(
            document.querySelector(config.formTarget!) as HTMLDivElement,
            cpm,
            onUserCompleteUIFlow,
            onValidationError,
            onError,
            params
          ),
      };
    } catch (e) {
      console.error(e);
      paymentRequests[provider] = {
        isLoading: false,
        isAvailable: false,
        startFlow: async () => {
          console.error(`${provider} is not available.`);
        },
      };
    }
  }

  return paymentRequests;
}

const setGlobalPaymentRequest = (pr: PaymentRequest, linkPr: PaymentRequest): void => {
  if ('ojs_pr' in window) {
    throw new Error('Attempted to set global PR twice');
  }
  // @ts-expect-error window typing
  window['ojs_pr'] = pr;
  // @ts-expect-error window typing
  window['ojs_link_pr'] = linkPr;
};

const hasGlobalPaymentRequest = (): boolean => {
  return 'ojs_pr' in window;
};

const getGlobalPaymentRequest = (): { pr: PaymentRequest; linkPr: PaymentRequest } => {
  if (!hasGlobalPaymentRequest()) {
    throw new Error('Global PR not set');
  }
  return {
    // @ts-expect-error window typing
    pr: window['ojs_pr'],
    // @ts-expect-error window typing
    linkPr: window['ojs_link_pr'],
  };
};

const updatePrWithAmount = (pr: PaymentRequest, amount: Amount, isPending: boolean): void => {
  pr.update({
    total: {
      amount: amount.amountAtom,
      label: 'Total',
      pending: isPending,
    },
    currency: amount.currency,
  });
};

export async function startPaymentRequestUserFlow(
  formDiv: HTMLDivElement,
  stripeCpm: CheckoutPaymentMethod,
  onUserCompleteUIFlow: (
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ) => void,
  onValidationError: ((field: FieldName, errors: string[], elementId?: string) => void) | undefined,
  onError: (errMsg: string) => void,
  params?: PaymentRequestStartParams
): Promise<void> {
  try {
    if (!validateFormFields(formDiv, onValidationError, stripeCpm)) {
      return;
    }

    const { pr, linkPr } = getGlobalPaymentRequest();
    const prToUse = stripeCpm.provider === 'stripe_link' ? linkPr : pr;

    if (params?.overridePaymentRequest) {
      const override = params.overridePaymentRequest;
      updatePrWithAmount(prToUse, override.amount, override.pending);
    }

    prToUse.show();
    const pmAddedEvent = await waitForUserToAddPaymentMethod(prToUse);
    onUserCompleteUIFlow(pmAddedEvent, stripeCpm);
  } catch (e) {
    console.error(e);
    onError(getErrorMessage(e));
  }
}

function validateFormFields(
  formDiv: HTMLDivElement,
  onValidationError: ((field: FieldName, errors: string[], elementId?: string) => void) | undefined,
  stripeXPrCpm: CheckoutPaymentMethod
): boolean {
  const startPaymentFlowEvent = constructSubmitEventPayload(
    EventType.enum.START_PAYMENT_FLOW,
    'dummy',
    formDiv,
    onValidationError ?? (() => {}),
    stripeXPrCpm,
    false
  );
  return !!startPaymentFlowEvent;
}
