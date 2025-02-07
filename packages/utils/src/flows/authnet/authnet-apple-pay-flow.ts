import { createInputsDictFromForm, OjsFlows } from '../../..';
import { getCheckoutPreviewAmount, getPrefill } from '../../cde-client';
import { PaymentFormPrefill } from '../../cde_models';
import { findCpmMatchingType } from '../common/common-flow-utils';
import {
  addBasicCheckoutCallbackHandlers,
  addErrorCatcherForInit,
  createOjsFlowLoggers,
  InitOjsFlow,
  RunOjsFlow,
  SimpleOjsFlowResult,
} from '../ojs-flow';
import { loadApplePayScript } from '../common/apple-pay-utils';
import { handlePaymentAuthorized, handleValidateMerchant } from './utils/apple-pay-session-handler';

const { log__, err__ } = createOjsFlowLoggers('authnet-applepay');

export const initAuthNetApplePayFlow: InitOjsFlow<any> = addErrorCatcherForInit(async ({ context, formCallbacks }) => {
  const applePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, 'apple_pay');
  if (!applePayCpm) {
    return { isAvailable: false, isLoading: false, startFlow: async () => {} };
  }

  log__(`Loading Apple Pay SDK...`);
  try {
    await loadApplePayScript();
    log__('Apple Pay SDK loaded successfully');
  } catch (err) {
    err__('Failed to load Apple Pay SDK', err);
    return { isAvailable: false, isLoading: false, startFlow: async () => {} };
  }

  if (!window.ApplePaySession || !ApplePaySession.canMakePayments()) {
    log__('Apple Pay is not available on this device/browser');
    return { isAvailable: false, isLoading: false, startFlow: async () => {} };
  }

  const canMakePayments = await ApplePaySession.canMakePayments();
  if (!canMakePayments) {
    log__('No active cards available for Apple Pay');
    return { isAvailable: false, isLoading: false, startFlow: async () => {} };
  }

  const anyCdeConnection = context.anyCdeConnection;
  const prefill = await getPrefill(anyCdeConnection);
  const isSetupMode = prefill.mode === 'setup';
  const initialPreview = await getCheckoutPreviewAmount(anyCdeConnection, prefill.token, isSetupMode, undefined);

  const processorAccount = applePayCpm.metadata;
  if (!processorAccount.processor_account_id) {
    throw new Error('No gateway merchant ID found in processor account');
  }

  const onApplePayStartFlow = async (customParams?: any) => {
    try {
      await OjsFlows.authNetApplePay.run({
        context,
        checkoutPaymentMethod: applePayCpm,
        nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
        formCallbacks,
        customParams: {
          isSetupMode,
          prefill,
          initialPreview,
          ...customParams,
        },
        initResult: undefined,
      });
    } catch (err) {
      err__('Apple Pay payment error', err);
      formCallbacks.get.onCheckoutError((err as Error)?.message ?? 'Unknown error');
    }
  };

  return {
    isAvailable: true,
    isLoading: false,
    startFlow: onApplePayStartFlow,
  };
});

type RunAuthNetApplePayFlowParams = {
  initialPreview: {
    currency: string;
    amountAtom: number;
  };
  isSetupMode: boolean;
  prefill: PaymentFormPrefill;
};

export const runAuthNetApplePayFlow: RunOjsFlow<RunAuthNetApplePayFlowParams> = addBasicCheckoutCallbackHandlers(
  async ({
    context,
    checkoutPaymentMethod,
    nonCdeFormInputs,
    customParams,
    formCallbacks,
  }): Promise<SimpleOjsFlowResult> => {
    const { initialPreview, isSetupMode, prefill } = customParams;

    const paymentRequest: ApplePayJS.ApplePayPaymentRequest = {
      countryCode: 'US',
      currencyCode: initialPreview.currency.toUpperCase(),
      total: {
        label: 'Total',
        amount: Math.max(initialPreview.amountAtom / 100, 0.0).toFixed(2),
        type: 'final',
      },
      requiredBillingContactFields: ['email', 'postalAddress', 'name'],
      requiredShippingContactFields: ['email'],
      supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
      merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
    };

    const session = new ApplePaySession(3, paymentRequest);

    const sessionContext = {
      session,
      connection: context.anyCdeConnection,
      checkoutPaymentMethod,
      nonCdeFormInputs,
      processorAccount: checkoutPaymentMethod.metadata,
      prefill,
      isSetupMode,
      baseUrl: context.baseUrl,
      formCallbacks,
    };

    return new Promise<SimpleOjsFlowResult>((resolve, reject) => {
      session.oncancel = () => {
        log__('Payment cancelled by user');
        reject(new Error('Payment cancelled by user'));
      };

      session.onvalidatemerchant = async (event) => {
        try {
          await handleValidateMerchant(event, sessionContext);
        } catch (err) {
          reject(err);
        }
      };

      session.onpaymentmethodselected = () => {
        const update: ApplePayJS.ApplePayPaymentMethodUpdate = {
          newTotal: paymentRequest.total,
        };
        session.completePaymentMethodSelection(update);
      };

      session.onpaymentauthorized = async (event) => {
        try {
          const result = await handlePaymentAuthorized(event, sessionContext);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      session.begin();
    }).catch((err) => {
      err__('Apple Pay payment error', err);
      throw err;
    });
  }
);
