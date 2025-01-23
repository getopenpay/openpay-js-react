import { z } from 'zod';
import { createInputsDictFromForm, FieldName, OjsFlows, ThreeDSStatus } from '../../..';
import { start3dsVerification } from '../../3ds-elements/events';
import {
  confirmPaymentFlow,
  getCheckoutPreviewAmount,
  getPrefill,
  getProcessorAccount,
  performCheckout,
  startPaymentFlow,
} from '../../cde-client';
import { CheckoutRequest, GetProcessorAccountResponse, PaymentFormPrefill } from '../../cde_models';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
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
import { fillEmptyFormInputsWithApplePay, loadApplePayScript } from './utils/apple-pay.utils';

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
    const processorAccount = await getProcessorAccount(context.anyCdeConnection, {
      checkout_secure_token: context.checkoutSecureToken,
      checkout_payment_method: applePayCpm,
    });

    log__('processorAccount', processorAccount);

    if (!processorAccount.id) {
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
            processorAccount,
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
  processorAccount: GetProcessorAccountResponse;
};

export const runAirwallexApplePayFlow: RunOjsFlow<RunAirwallexApplePayFlowParams> = addBasicCheckoutCallbackHandlers(
  async ({
    context,
    checkoutPaymentMethod,
    nonCdeFormInputs,
    customParams,
    formCallbacks,
  }): Promise<SimpleOjsFlowResult> => {
    const { initialPreview, processorAccount, isSetupMode, prefill } = customParams;

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

    log__('paymentRequest', paymentRequest);
    const session = new ApplePaySession(3, paymentRequest);
    log__('session', session);
    // session.addEventListener('cancel', () => {
    //   log__('Payment cancelled by user event listener');
    //   session.abort();
    //   throw new Error('Payment cancelled by user');
    // });
    // session.addEventListener('abort', (event) => {
    //   log__('Payment aborted', event);
    //   session.abort();
    //   throw new Error('Payment aborted');
    // });

    const promise = new Promise<SimpleOjsFlowResult>((resolve, reject) => {
      console.log('new Promise');

      session.oncancel = () => {
        log__('Payment cancelled by user oncancel');
        // session.abort();
        reject(new Error('Payment cancelled by user'));
      };
      const anyCdeConnection = context.anyCdeConnection;

      let consentId: string;

      session.onvalidatemerchant = async (event) => {
        log__('onvalidatemerchant', event);
        try {
          const startPaymentFlowResponse = await startPaymentFlow(anyCdeConnection, {
            payment_provider: checkoutPaymentMethod.provider,
            checkout_payment_method: checkoutPaymentMethod,
            new_customer_email: nonCdeFormInputs[FieldName.EMAIL] as string,
            new_customer_first_name: nonCdeFormInputs[FieldName.FIRST_NAME] as string,
            new_customer_last_name: nonCdeFormInputs[FieldName.LAST_NAME] as string,
            payment_session: {
              validation_url: event.validationURL,
              initiative_context: window.location.hostname,
              their_account_id: processorAccount.id,
            },
          });

          const paymentSessionResponse = startPaymentFlowResponse.required_user_actions.find(
            (action) => Object.keys(action)[0] === 'payment_session'
          );
          consentId = startPaymentFlowResponse.required_user_actions[0].consent_id;
          log__('Consent ID:', consentId);

          if (!paymentSessionResponse) {
            throw new Error('No session data received from payment flow');
          }

          session.completeMerchantValidation(paymentSessionResponse['payment_session']);
        } catch (err) {
          session.abort();
          throw err;
        }
      };

      session.onpaymentmethodselected = (event) => {
        log__('Payment method selected', event.paymentMethod);
        // @ts-expect-error - no update
        session.completePaymentMethodSelection({});
      };

      session.onpaymentauthorized = async (event) => {
        try {
          const paymentData = event.payment;

          const formInputs = fillEmptyFormInputsWithApplePay(nonCdeFormInputs, paymentData.billingContact);
          const nonCdeFormFields = validateNonCdeFormFieldsForCC(formInputs, formCallbacks.get.onValidationError);

          const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
            secure_token: prefill.token,
            consent_id: consentId,
            payment_provider: checkoutPaymentMethod.provider,
            // ApplePay's encrypted_payment_token provided to verify the consent first
            payment_method_data: {
              type: 'applepay',
              applepay: {
                payment_data_type: 'encrypted_payment_token',
                encrypted_payment_token: paymentData.token,
              },
            },
          });

          log__('[1st] Confirm payment flow response', confirmResult);
          // If there's 3DS required, this will be null
          let ourPmId = confirmResult.payment_methods?.[0]?.id;

          const nextActionMetadata = confirmResult.required_user_actions?.find(
            (action) => action.type === 'airwallex_payment_consent'
          );

          if (nextActionMetadata && nextActionMetadata.redirect_url) {
            log__('3DS Required, starting verification...', nextActionMetadata);
            const { status } = await start3dsVerification({
              url: nextActionMetadata.redirect_url,
              baseUrl: context.baseUrl,
            });
            log__(`╰ 3DS verification completed [Status: ${status}]`);
            if (status === ThreeDSStatus.CANCELLED) {
              throw new Error('3DS verification cancelled');
            }
            if (status === ThreeDSStatus.FAILURE) {
              throw new Error('3DS verification failed');
            }
          }

          if (nextActionMetadata && !ourPmId) {
            // confirm flow again
            const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
              secure_token: prefill.token,
              consent_id: nextActionMetadata.consent_id,
              payment_provider: checkoutPaymentMethod.provider,
              their_pm_id: nextActionMetadata.their_pm_id,
            });

            log__('[2nd] Confirm payment flow response', confirmResult);
            ourPmId = confirmResult.payment_methods?.[0]?.id;
          }

          if (!ourPmId) {
            throw new Error('No PM ID found');
          }
          session.completePayment(ApplePaySession.STATUS_SUCCESS);

          // Return the appropriate result based on mode
          if (isSetupMode) {
            resolve({ mode: 'setup', result: { payment_method_id: ourPmId } });
          } else {
            const checkoutRequest: CheckoutRequest = {
              secure_token: prefill.token,
              payment_input: {
                provider_type: checkoutPaymentMethod.provider,
              },
              do_not_use_legacy_cc_flow: true,
              use_confirmed_pm_id: ourPmId,
              line_items: prefill.line_items,
              total_amount_atom: prefill.amount_total_atom,
              cancel_at_end: false,
              checkout_payment_method: checkoutPaymentMethod,
              customer_email: nonCdeFormFields[FieldName.EMAIL] as string,
              customer_zip_code: nonCdeFormFields[FieldName.ZIP_CODE] as string,
              customer_country: nonCdeFormFields[FieldName.COUNTRY] as string,
              promotion_code: nonCdeFormFields[FieldName.PROMOTION_CODE] as string,
            };

            const result = await performCheckout(anyCdeConnection, checkoutRequest);
            resolve({ mode: 'checkout', result });
          }
        } catch (err) {
          session.completePayment(ApplePaySession.STATUS_FAILURE);
          throw err;
        }
      };

      session.begin();
    });

    const result = await promise.catch((e) => {
      log__('promise error', e);
      throw e;
    });
    return result;
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
