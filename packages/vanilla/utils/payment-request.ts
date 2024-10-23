import {
  CheckoutPaymentMethod,
  PaymentRequestStatus,
  PaymentRequestStartParams,
  createStripePaymentRequest,
  parseStripePubKey,
  waitForUserToAddPaymentMethod,
  getCheckoutPreview,
  getPrefill,
  OptionalString,
  Amount,
  getErrorMessage,
  CdeConnection,
  createInputsDictFromForm,
  FieldName,
  constructSubmitEventPayload,
  EventType,
} from '@getopenpay/utils';
import { Config } from '../index';
import { PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';

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
): Promise<Record<'apple_pay' | 'google_pay', PaymentRequestStatus>> {
  const paymentRequests: Record<'apple_pay' | 'google_pay', PaymentRequestStatus> = {
    apple_pay: { isLoading: true, isAvailable: false, startFlow: async () => {} },
    google_pay: { isLoading: true, isAvailable: false, startFlow: async () => {} },
  };

  for (const provider of ['apple_pay', 'google_pay'] as const) {
    try {
      const stripeXPrCpm = checkoutPaymentMethods.find(
        (cpm) => cpm.provider === provider && cpm.processor_name === 'stripe'
      );
      if (!stripeXPrCpm) {
        throw new Error(`${provider} is not available as a checkout method`);
      }
      const stripePubKey = parseStripePubKey(stripeXPrCpm.metadata);
      const isAvailable = await checkIfProviderIsAvailable(stripePubKey, provider);

      paymentRequests[provider] = {
        isLoading: false,
        isAvailable,
        startFlow: (params?: PaymentRequestStartParams) =>
          startPaymentRequestUserFlow(
            cdeConn,
            config.checkoutSecureToken!,
            document.querySelector(config.formTarget!) as HTMLDivElement,
            stripeXPrCpm,
            stripePubKey,
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

async function checkIfProviderIsAvailable(
  stripePubKey: string,
  provider: 'apple_pay' | 'google_pay'
): Promise<boolean> {
  const DUMMY_AMOUNT_ATOM = 1000;
  const testerPR = await createStripePaymentRequest(stripePubKey, DUMMY_AMOUNT_ATOM, 'usd');
  const canMakePayment = await testerPR.canMakePayment();
  testerPR.abort();
  if (!canMakePayment) {
    throw new Error(`Cannot make payment with ${provider} for this session`);
  }
  return canMakePayment[provider === 'apple_pay' ? 'applePay' : 'googlePay'];
}

export async function startPaymentRequestUserFlow(
  cdeConn: CdeConnection,
  secureToken: string,
  formDiv: HTMLDivElement,
  stripeXPrCpm: CheckoutPaymentMethod,
  stripePubKey: string,
  onUserCompleteUIFlow: (
    stripePm: PaymentRequestPaymentMethodEvent,
    checkoutPaymentMethod: CheckoutPaymentMethod
  ) => void,
  onValidationError: ((field: FieldName, errors: string[], elementId?: string) => void) | undefined,
  onError: (errMsg: string) => void,
  prStartParams: PaymentRequestStartParams | undefined
): Promise<void> {
  try {
    const formData = createInputsDictFromForm(formDiv, {});
    if (!validateFormFields(formDiv, onValidationError, stripeXPrCpm)) {
      return;
    }
    const prefill = await getPrefill(cdeConn);
    const isSetupMode = prefill.mode === 'setup';

    const amountForPR = await getAmountForPaymentRequest(isSetupMode, prStartParams, formData, cdeConn, secureToken);

    const pr = await createStripePaymentRequest(
      stripePubKey,
      amountForPR.amountAtom,
      amountForPR.currency,
      isSetupMode
    );
    await pr.canMakePayment();
    pr.show();
    const pmAddedEvent = await waitForUserToAddPaymentMethod(pr);
    onUserCompleteUIFlow(pmAddedEvent, stripeXPrCpm);
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

async function getAmountForPaymentRequest(
  isSetupMode: boolean,
  prStartParams: PaymentRequestStartParams | undefined,
  formData: Record<string, unknown>,
  cdeConn: CdeConnection,
  secureToken: string
): Promise<Amount> {
  if (isSetupMode) {
    // TODO: sync with react
    return prStartParams?.overridePaymentRequest?.amount ?? { amountAtom: 0, currency: 'usd' };
  }

  if (prStartParams?.overridePaymentRequest) {
    console.warn('Warning: amountToDisplayForSetupMode passed in non-setup mode. This parameter will be ignored.');
  }

  const promoCodeParsed = OptionalString.safeParse(formData[FieldName.PROMOTION_CODE]);
  if (!promoCodeParsed.success) {
    throw new Error(`Unknown promo code type: ${promoCodeParsed.error.message}`);
  }

  const checkoutPreview = await getCheckoutPreview(cdeConn, {
    secure_token: secureToken,
    promotion_code: promoCodeParsed.data,
  });

  const currencies = new Set(checkoutPreview.preview.invoices.map((inv) => inv.currency));
  if (currencies.size !== 1) {
    throw new Error(`Expected exactly one currency, got ${currencies.size}`);
  }

  const currency = currencies.values().next().value as string;
  const amountAtom = checkoutPreview.preview.invoices.reduce((sum, inv) => sum + inv.remaining_amount_atom, 0);

  return { amountAtom, currency };
}
