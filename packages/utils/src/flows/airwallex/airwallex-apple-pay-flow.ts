import { z } from 'zod';
import { Common3DSNextActionMetadata, createInputsDictFromForm, FieldName, OjsFlows, ThreeDSStatus } from '../../..';
import { start3dsVerification } from '../../3ds-elements/events';
import {
  confirmPaymentFlow,
  getCheckoutPreviewAmount,
  getPrefill,
  getProcessorAccount,
  performCheckout,
  startPaymentFlow,
  startPaymentSession,
} from '../../cde-client';
import { CheckoutRequest } from '../../cde_models';
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
import { parseAirwallex3DSNextActionMetadata } from './airwallex-google-pay-flow';

declare global {
  interface Window {
    ApplePaySession?: typeof ApplePaySession;
  }
}

export type AirwallexApplePayController = {
  mountButton: () => void;
  dismountButton: () => void;
  waitForButtonToMount: () => Promise<HTMLElement>;
  startFlow: () => Promise<void>;
};

export type InitAirwallexGPayFlowResult =
  | {
      isAvailable: true;
      controller: AirwallexApplePayController;
    }
  | {
      isAvailable: false;
    };

const OJS_APPLEPAY_BTN_ID = 'ojs-airwallex-applepay-btn';
const { log__, err__ } = createOjsFlowLoggers('applepay');

export type InitApplePayFlowResult =
  | {
      isAvailable: true;
      controller: AirwallexApplePayController;
    }
  | {
      isAvailable: false;
    };

export const ApplePayCpm = z.object({
  provider: z.literal('apple_pay'),
  processor_name: z.literal('airwallex'),
});
export type ApplePayCpm = z.infer<typeof ApplePayCpm>;

const createApplePayButton = (): HTMLElement => {
  const button = document.createElement('apple-pay-button');
  button.setAttribute('buttonstyle', 'black');
  button.setAttribute('type', 'plain');
  button.setAttribute('locale', 'en');

  // Style the button
  button.style.cssText = `
    -webkit-appearance: -apple-pay-button;
    -apple-pay-button-style: black;
    -apple-pay-button-type: plain;
    display: inline-block;
    width: 100%;
    min-height: 40px;
    border: 0;
  `;

  return button;
};

// const getApplePaymentRequest = (
//   isSetupMode: boolean,
//   preview: Amount,
//   merchantId: string
// ): ApplePayJS.ApplePayPaymentRequest => {
//   console.log('getApplePaymentRequest', isSetupMode, preview, merchantId);
//   const amount = Math.max(preview.amountAtom / 100, 0.01);

//   const baseRequest: ApplePayJS.ApplePayPaymentRequest = {
//     countryCode: 'US',
//     currencyCode: preview.currency?.toUpperCase() ?? 'USD',
//     supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
//     merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
//     total: {
//       label: isSetupMode ? 'Setup Payment' : 'Payment Total',
//       amount: amount.toFixed(2),
//       type: 'final',
//     },
//     // merchantIdentifier: merchantId,
//   };

//   if (isSetupMode) {
//     return {
//       ...baseRequest,
//       recurringPaymentRequest: {
//         managementURL: 'https://example.com/manage',
//         paymentDescription: 'Subscription Payment',
//         regularBilling: {
//           label: 'Subscription',
//           amount: amount.toFixed(2),
//         },
//       },
//     };
//   }

//   return baseRequest;
// };

// Add SDK loading function
const loadApplePayScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Apple Pay SDK'));
    document.body.appendChild(script);
  });
};

export const initAirwallexApplePayFlow: InitOjsFlow<InitApplePayFlowResult> = addErrorCatcherForInit(
  async ({ context, formCallbacks }): Promise<InitApplePayFlowResult> => {
    const initParams = context.customInitParams.applePay;
    const applePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, ApplePayCpm);

    if (!applePayCpm) {
      return { isAvailable: false };
    }

    // Get processor account details
    const processorAccount = await getProcessorAccount(context.anyCdeConnection, {
      checkout_secure_token: context.checkoutSecureToken,
      checkout_payment_method: applePayCpm,
    });

    if (!processorAccount.id) {
      err__('No gateway merchant ID found in processor account');
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
        amount: (initialPreview.amountAtom / 100).toFixed(2),
        type: 'final',
      },
    };

    const onApplePayStartFlow = async () => {
      try {
        const session = new ApplePaySession(3, paymentRequest);
        log__('Apple Pay session created', session);

        session.onvalidatemerchant = async (event) => {
          try {
            log__('onvalidatemerchant', event);
            const validationUrl = event.validationURL;

            const sessionResponse = await startPaymentSession(context.anyCdeConnection, {
              checkout_secure_token: context.checkoutSecureToken,
              checkout_payment_method: applePayCpm,
              validation_url: validationUrl,
              payment_intent_id: '', // This should come from your payment intent creation
              initiative_context: window.location.hostname,
              their_account_id: processorAccount.id,
            });

            log__('Apple Pay session response', sessionResponse);
            session.completeMerchantValidation(sessionResponse);
          } catch (err) {
            err__('Merchant validation failed', err);
            session.abort();
          }
        };

        session.onpaymentauthorized = async (event) => {
          try {
            const paymentData = event.payment;
            log__('Payment authorized', paymentData);
            const billingContact = paymentData.billingContact;

            log__('Billing contact', billingContact);

            await OjsFlows.airwallexApplePay.run({
              context,
              checkoutPaymentMethod: applePayCpm,
              nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
              formCallbacks,
              customParams: { paymentData },
              initResult: {
                isAvailable: true,
                controller: {
                  mountButton,
                  dismountButton,
                  waitForButtonToMount: async () => await getElementByIdAsync(OJS_APPLEPAY_BTN_ID),
                  startFlow: async () => {},
                },
              },
            });

            session.completePayment(ApplePaySession.STATUS_SUCCESS);
          } catch (err) {
            err__('Payment authorization failed', err);
            session.completePayment(ApplePaySession.STATUS_FAILURE);
            formCallbacks.get.onCheckoutError((err as Error)?.message ?? 'Unknown error');
          }
        };

        session.begin();
      } catch (err) {
        err__('Apple Pay session error', err);
        formCallbacks.get.onCheckoutError((err as Error)?.message ?? 'Unknown error');
      }
    };

    let applePayButton: HTMLElement | null = null;
    const mountButton = async () => {
      const container = document.getElementById(OJS_APPLEPAY_BTN_ID);
      if (container) {
        applePayButton = createApplePayButton();
        applePayButton.addEventListener('click', onApplePayStartFlow);
        container.appendChild(applePayButton);
      }
    };

    const dismountButton = () => {
      if (applePayButton) {
        applePayButton.remove();
        applePayButton = null;
      }
    };

    if (!initParams?.doNotMountOnInit) {
      log__('Mounting Apple Pay button...');
      await mountButton();
    }

    return {
      isAvailable: true,
      controller: {
        mountButton,
        dismountButton,
        waitForButtonToMount: async () => await getElementByIdAsync(OJS_APPLEPAY_BTN_ID),
        startFlow: async () => {
          log__('Starting Apple Pay flow by clicking button...');
          await onApplePayStartFlow();
        },
      },
    };
  }
);

const getElementByIdAsync = (id: string) =>
  new Promise<HTMLElement>((resolve) => {
    const getElement = () => {
      const element = document.getElementById(id);
      if (element) {
        resolve(element);
      } else {
        requestAnimationFrame(getElement);
      }
    };
    getElement();
  });

type RunApplePayFlowParams = {
  paymentData: ApplePayJS.ApplePayPayment;
};

export const runAirwallexApplePayFlow: RunOjsFlow<RunApplePayFlowParams, InitApplePayFlowResult> =
  addBasicCheckoutCallbackHandlers(
    async ({
      context,
      checkoutPaymentMethod,
      nonCdeFormInputs,
      customParams,
      formCallbacks,
    }): Promise<SimpleOjsFlowResult> => {
      log__('Starting Apple Pay flow...');
      const extractedBillingAddress = customParams.paymentData.billingContact;

      // If billing form fields are empty, try to replace with Apple Pay billing address
      if (extractedBillingAddress) {
        const applePayAddressToOjsFormFields = {
          [FieldName.COUNTRY]: extractedBillingAddress.countryCode,
          [FieldName.ADDRESS]: extractedBillingAddress.addressLines?.join(', '),
          [FieldName.CITY]: extractedBillingAddress.locality,
          [FieldName.ZIP_CODE]: extractedBillingAddress.postalCode,
          [FieldName.STATE]: extractedBillingAddress.administrativeArea,
          [FieldName.FIRST_NAME]: extractedBillingAddress.givenName,
          [FieldName.LAST_NAME]: extractedBillingAddress.familyName,
        };

        for (const [fieldName, value] of Object.entries(applePayAddressToOjsFormFields)) {
          if (!nonCdeFormInputs[fieldName]) {
            nonCdeFormInputs[fieldName] = value;
          }
        }
      }

      log__('Non-CDE fields to validate', nonCdeFormInputs);
      const nonCdeFormFields = validateNonCdeFormFieldsForCC(nonCdeFormInputs, formCallbacks.get.onValidationError);
      const anyCdeConnection = context.anyCdeConnection;
      const prefill = await getPrefill(anyCdeConnection);

      const startPaymentFlowResponse = await startPaymentFlow(anyCdeConnection, {
        payment_provider: checkoutPaymentMethod.provider,
        checkout_payment_method: checkoutPaymentMethod,
        new_customer_email: nonCdeFormFields[FieldName.EMAIL],
        new_customer_first_name: nonCdeFormFields[FieldName.FIRST_NAME],
        new_customer_last_name: nonCdeFormFields[FieldName.LAST_NAME],
        payment_method_data: {
          type: 'applepay',
          applepay: {
            payment_data: customParams.paymentData,
          },
        },
      });

      let ourPmId: string | undefined = undefined;
      let possibleNextAction: Common3DSNextActionMetadata | null = null;

      try {
        possibleNextAction = parseAirwallex3DSNextActionMetadata(startPaymentFlowResponse);
        log__('Possible next action', possibleNextAction);
      } catch (e) {
        err__('Not required 3DS verification', e);
      }

      // Handle 3DS if required
      if (possibleNextAction?.type === 'airwallex_payment_consent' && possibleNextAction.redirect_url) {
        const { status } = await start3dsVerification({
          url: possibleNextAction.redirect_url,
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

      // Always confirm payment flow, with or without 3DS
      const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
        secure_token: prefill.token,
        consent_id: possibleNextAction?.consent_id,
        their_pm_id: possibleNextAction?.their_pm_id,
        payment_method_data: {
          type: 'applepay',
          applepay: {
            payment_data: customParams.paymentData,
          },
        },
      });
      log__('Confirm result', confirmResult);
      ourPmId = confirmResult.payment_methods?.[0]?.id;

      log__('Start payment flow response', startPaymentFlowResponse);
      const nextActionMetadata = startPaymentFlowResponse.required_user_actions;
      log__('Next action metadata', nextActionMetadata);

      if (prefill.mode === 'setup') {
        if (!ourPmId) {
          throw new Error('No PM ID found');
        }
        return { mode: 'setup', result: { payment_method_id: ourPmId } };
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
          customer_email: nonCdeFormFields[FieldName.EMAIL],
          customer_zip_code: nonCdeFormFields[FieldName.ZIP_CODE],
          customer_country: nonCdeFormFields[FieldName.COUNTRY],
          promotion_code: nonCdeFormFields[FieldName.PROMOTION_CODE],
        };

        const result = await performCheckout(anyCdeConnection, checkoutRequest);
        return { mode: 'checkout', result };
      }
    }
  );
