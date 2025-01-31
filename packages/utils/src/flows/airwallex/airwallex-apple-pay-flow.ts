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
import { handlePaymentAuthorized, handleValidateMerchant, SessionContext } from './utils/apple-pay-session-handler';
import { loadApplePayScript } from './utils/apple-pay.utils';
import { AirwallexApplePayFlowCustomParams, InitAirwallexApplePayFlowResult } from './types/apple-pay.types';

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

export const initAirwallexApplePayFlow: InitOjsFlow<InitAirwallexApplePayFlowResult> = addErrorCatcherForInit(
  async ({ context, formCallbacks }): Promise<InitAirwallexApplePayFlowResult> => {
    const applePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, ApplePayCpm);

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
    log__('Apple Pay Loaded');

    // Check if merchant can accept the payment
    const canMakePayments = await ApplePaySession.canMakePayments();
    if (!canMakePayments) {
      log__('No active cards available for Apple Pay');
      return { isAvailable: false, isLoading: false, startFlow: async () => {} };
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

    const onApplePayStartFlow = async (customParams?: AirwallexApplePayFlowCustomParams) => {
      try {
        // This needs to be called directly from a user gesture (click/tap)
        await OjsFlows.airwallexApplePay.run({
          context,
          checkoutPaymentMethod: applePayCpm,
          nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
          formCallbacks: formCallbacks,
          customParams: {
            isSetupMode,
            prefill,
            initialPreview: customParams?.overridePaymentRequest?.amount ?? initialPreview,
            overridePaymentRequest: customParams?.overridePaymentRequest,
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
  }
);

type RunAirwallexApplePayFlowParams = {
  initialPreview: {
    currency: string;
    amountAtom: number;
  };
  isSetupMode: boolean;
  prefill: PaymentFormPrefill;
} & AirwallexApplePayFlowCustomParams;

export const runAirwallexApplePayFlow: RunOjsFlow<RunAirwallexApplePayFlowParams> = addBasicCheckoutCallbackHandlers(
  async ({
    context,
    checkoutPaymentMethod,
    nonCdeFormInputs,
    customParams,
    formCallbacks,
  }): Promise<SimpleOjsFlowResult> => {
    const applePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, ApplePayCpm);
    const { initialPreview, isSetupMode, prefill, overridePaymentRequest } = customParams;

    const currencyCode = (overridePaymentRequest?.amount?.currency ?? initialPreview.currency ?? 'USD').toUpperCase();
    const amount = overridePaymentRequest?.amount?.amountAtom
      ? (overridePaymentRequest.amount.amountAtom / 100).toFixed(2)
      : Math.max(initialPreview.amountAtom / 100, 0.0).toFixed(2);

    const total: ApplePayJS.ApplePayPaymentRequest['total'] = {
      label: overridePaymentRequest?.label ?? (isSetupMode ? 'Setup Payment' : 'Payment Total'),
      type: overridePaymentRequest?.pending ? 'pending' : 'final',
      amount,
    };

    const paymentRequest: ApplePayJS.ApplePayPaymentRequest = {
      countryCode: 'US',
      currencyCode,
      requiredBillingContactFields: ['email', 'name', 'postalAddress'],
      supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
      merchantCapabilities: [
        'supports3DS',
        'supportsCredit',
        'supportsDebit',
        'supportsEMV',
      ] as ApplePayJS.ApplePayMerchantCapability[],
      total,
      ...(overridePaymentRequest?.applePayPaymentRequest ?? {}),
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
        reject(new Error('Payment cancelled by user'));
      };

      session.onvalidatemerchant = async (event) => {
        try {
          consentId = await handleValidateMerchant(event, sessionContext);
        } catch (err) {
          reject(err);
        }
      };

      session.onshippingmethodselected = (event) => {
        log__('Shipping method selected', event.shippingMethod);
      };

      session.onshippingmethodselected = (event) => {
        log__('Shipping method selected', event.shippingMethod);
        // @ts-expect-error - No updates or errors are needed, pass an empty object.
        const update: ApplePayJS.ApplePayShippingMethodUpdate = {};
        session.completeShippingMethodSelection(update);
      };

      session.onshippingcontactselected = (event) => {
        log__('Shipping contact selected', event.shippingContact);
        // @ts-expect-error - No updates or errors are needed, pass an empty object.
        const update: ApplePayJS.ApplePayShippingContactUpdate = {};
        session.completeShippingContactSelection(update);
      };

      session.onpaymentmethodselected = (event) => {
        log__('Payment method selected', event.paymentMethod);
        const update: ApplePayJS.ApplePayPaymentMethodUpdate = {
          newTotal: { ...total },
        };
        session.completePaymentMethodSelection(update);
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
