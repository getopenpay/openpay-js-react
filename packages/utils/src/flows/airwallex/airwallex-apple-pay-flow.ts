import { z } from 'zod';
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
import { InitApplePayFlowResult } from './types/apple-pay.types';
import { handlePaymentAuthorized, handleValidateMerchant, SessionContext } from './utils/apple-pay-session-handler';
import { loadApplePayScript } from './utils/apple-pay.utils';

export type InitAirwallexGPayFlowResult =
  | {
      isAvailable: true;
      startFlow: () => Promise<void>;
    }
  | {
      isAvailable: false;
    };

const { log__, err__ } = createOjsFlowLoggers('applepay');

export const ApplePayCpm = z.object({
  provider: z.literal('apple_pay'),
  processor_name: z.literal('airwallex'),
  metadata: z.object({
    processor_account_id: z.string(),
    processor_account_name: z.string(),
  }),
});
export type ApplePayCpm = z.infer<typeof ApplePayCpm>;

export const initAirwallexApplePayFlow: InitOjsFlow<InitApplePayFlowResult> = addErrorCatcherForInit(
  async ({ context, formCallbacks }): Promise<InitApplePayFlowResult> => {
    const applePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, ApplePayCpm);

    if (!applePayCpm) {
      return { isAvailable: false };
    }

    log__(`Loading Apple Pay SDK...`);
    try {
      await loadApplePayScript();
      log__('Apple Pay SDK loaded successfully');
    } catch (err) {
      err__('Failed to load Apple Pay SDK', err);
      return { isAvailable: false };
    }

    if (!window.ApplePaySession || !ApplePaySession.canMakePayments()) {
      log__('Apple Pay is not available on this device/browser');
      return { isAvailable: false };
    }
    log__('Apple Pay Loaded');

    // Check if merchant can accept the payment
    const canMakePayments = await ApplePaySession.canMakePayments();
    if (!canMakePayments) {
      log__('No active cards available for Apple Pay');
      return { isAvailable: false };
    }

    const anyCdeConnection = context.anyCdeConnection;
    const prefill = await getPrefill(anyCdeConnection);
    const isSetupMode = prefill.mode === 'setup';
    const initialPreview = await getCheckoutPreviewAmount(anyCdeConnection, prefill.token, isSetupMode, undefined);

    // Get processor account details
    const processorAccount = applePayCpm.metadata;

    log__('processorAccount', processorAccount);

    if (!processorAccount.processor_account_id) {
      throw new Error('No gateway merchant ID found in processor account');
    }

    const onApplePayStartFlow = async () => {
      try {
        // This needs to be called directly from a user gesture (click/tap)
        await OjsFlows.airwallexApplePay.run({
          context,
          checkoutPaymentMethod: applePayCpm,
          nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
          formCallbacks: formCallbacks,
          customParams: {
            initialPreview,
            isSetupMode,
            prefill,
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
      startFlow: onApplePayStartFlow,
    };
  }
);

type RunAirwallexApplePayFlowParams = {
  initialPreview: {
    currency: string;
    amountAtom: number;
  };
  isSetupMode: boolean;
  prefill: PaymentFormPrefill;
};

export const runAirwallexApplePayFlow: RunOjsFlow<RunAirwallexApplePayFlowParams> = addBasicCheckoutCallbackHandlers(
  async ({
    context,
    checkoutPaymentMethod,
    nonCdeFormInputs,
    customParams,
    formCallbacks,
  }): Promise<SimpleOjsFlowResult> => {
    const applePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, ApplePayCpm);
    const { initialPreview, isSetupMode, prefill } = customParams;

    const paymentRequest: ApplePayJS.ApplePayPaymentRequest = {
      countryCode: 'US',
      currencyCode: initialPreview.currency?.toUpperCase() ?? 'USD',
      supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
      merchantCapabilities: [
        'supports3DS',
        'supportsCredit',
        'supportsDebit',
        'supportsEMV',
      ] as ApplePayJS.ApplePayMerchantCapability[],
      total: {
        label: isSetupMode ? 'Setup Payment' : 'Payment Total',
        amount: isSetupMode ? '0.00' : (initialPreview.amountAtom / 100).toFixed(2),
        type: 'final',
      },
    };

    log__('Payment Request', paymentRequest);
    const session = new ApplePaySession(3, paymentRequest);
    log__('ApplePaySession', session);

    const sessionContext: SessionContext = {
      session,
      connection: context.anyCdeConnection,
      checkoutPaymentMethod,
      nonCdeFormInputs,
      processorAccount: applePayCpm.metadata,
      prefill,
      isSetupMode,
      baseUrl: context.baseUrl,
      formCallbacks,
    };

    let consentId: string;

    return new Promise<SimpleOjsFlowResult>((resolve, reject) => {
      session.oncancel = () => {
        log__('Payment cancelled by user');
        session.abort();
        reject(new Error('Payment cancelled by user'));
      };

      session.onvalidatemerchant = async (event) => {
        try {
          consentId = await handleValidateMerchant(event, sessionContext);
        } catch (err) {
          reject(err);
        }
      };

      session.onpaymentmethodselected = (event) => {
        log__('Payment method selected', event.paymentMethod);
        session.completePaymentMethodSelection({
          newTotal: paymentRequest.total,
        });
      };

      session.onpaymentauthorized = async (event) => {
        try {
          const result = await handlePaymentAuthorized(event, sessionContext, consentId);
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

// Apply pay PM example:
//   {
//     "target": {
//         "onshippingcontactselected": null,
//         "onshippingmethodselected": null,
//         "oncouponcodechanged": null
//     },
//     "srcElement": {
//         "onshippingcontactselected": null,
//         "onshippingmethodselected": null,
//         "oncouponcodechanged": null
//     },
//     "paymentMethod": {
//         "type": "credit"
//     }
// }
