import { z } from 'zod';
import { createInputsDictFromForm, FieldName, FRAME_BASE_URL, OjsFlows, ThreeDSStatus } from '../../..';
import { start3dsVerification } from '../../3ds-elements/events';
import {
  confirmPaymentFlow,
  getCheckoutPreviewAmount,
  getPrefill,
  performCheckout,
  startPaymentFlow,
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
import {
  AirwallexGooglePayFlowCustomParams,
  InitAirwallexGooglePayFlowResult,
  PaymentDataRequest,
  PaymentsClient,
} from './types/google-pay.types';
import {
  fillEmptyFormInputsWithGooglePay,
  getPaymentDataRequest,
  loadGooglePayScript,
  parseAirwallexStartPaymentFlowResponse,
} from './utils/google-pay.utils';

const { log__, err__ } = createOjsFlowLoggers('awx-google-pay');

let paymentsClient: PaymentsClient | null = null;

const getGooglePayEnvironment = (baseUrl: string) => {
  // OpenPay Hosted Checkout page origin and OJS base URL is the same
  const isProduction = baseUrl === FRAME_BASE_URL || baseUrl === window.location.origin;
  return isProduction ? 'PRODUCTION' : 'TEST';
};

const getGooglePaymentsClient = (baseUrl: string, paymentDataRequest: PaymentDataRequest): PaymentsClient => {
  const environment = getGooglePayEnvironment(baseUrl);

  if (paymentsClient === null) {
    paymentsClient = new window.google!.payments.api.PaymentsClient({
      environment,
      merchantInfo: paymentDataRequest.merchantInfo,
    });
  }
  return paymentsClient!;
};

export const GooglePayCpm = z.object({
  provider: z.literal('google_pay'),
  processor_name: z.literal('airwallex'),
  metadata: z.object({
    processor_account_id: z.string(),
    processor_account_name: z.string(),
    google_pay_merchant_id: z.string().nullish(),
  }),
});
export type GooglePayCpm = z.infer<typeof GooglePayCpm>;

export const initAirwallexGooglePayFlow: InitOjsFlow<InitAirwallexGooglePayFlowResult> = addErrorCatcherForInit(
  async ({ context, formCallbacks }): Promise<InitAirwallexGooglePayFlowResult> => {
    const googlePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, GooglePayCpm);
    if (!googlePayCpm) {
      return { isAvailable: false, isLoading: false, startFlow: async () => {} };
    }

    log__('Google Pay CPM', googlePayCpm);

    // Get processor account details
    const processorAccount = googlePayCpm.metadata;

    if (!processorAccount.processor_account_id) {
      err__('No gateway merchant ID found in processor account');
      return { isAvailable: false, isLoading: false, startFlow: async () => {} };
    }

    log__(`Loading Google Pay SDK...`);
    await loadGooglePayScript();

    if (!window.google?.payments?.api) {
      err__('Google Pay SDK not loaded properly');
      return { isAvailable: false, isLoading: false, startFlow: async () => {} };
    }

    const environment = getGooglePayEnvironment(context.baseUrl);
    if (environment === 'PRODUCTION' && !processorAccount.google_pay_merchant_id) {
      err__('Google Pay merchant ID is required for production environment');
      return { isAvailable: false, isLoading: false, startFlow: async () => {} };
    }

    log__('Google Pay SDK loaded', window.google.payments);

    // Check if Google Pay is available for the user
    try {
      const paymentDataRequest = getPaymentDataRequest({
        gateway: 'airwallex',
        gatewayMerchantId: processorAccount.processor_account_id,
        merchantName: processorAccount.processor_account_name,
        merchantId: processorAccount.google_pay_merchant_id ?? '',
        initialPreview: undefined,
      });
      const { result: isReadyToPay } = await getGooglePaymentsClient(context.baseUrl, paymentDataRequest).isReadyToPay(
        paymentDataRequest
      );

      if (!isReadyToPay) {
        log__('Google Pay is not available for this user');
        return { isAvailable: false, isLoading: false, startFlow: async () => {} };
      }
    } catch (err) {
      err__('Error checking Google Pay availability', err);
      return { isAvailable: false, isLoading: false, startFlow: async () => {} };
    }

    const onGooglePayStartFlow = async (customParams?: AirwallexGooglePayFlowCustomParams) => {
      try {
        OjsFlows.airwallexGooglePay.run({
          context,
          checkoutPaymentMethod: googlePayCpm,
          nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
          formCallbacks,
          initResult: undefined,
          customParams: customParams ?? {},
        });
      } catch (err) {
        err__('Google Pay payment error', err);
        formCallbacks.get.onCheckoutError((err as Error)?.message ?? 'Unknown error');
      }
    };

    return {
      isAvailable: true,
      isLoading: false,
      startFlow: onGooglePayStartFlow,
    };
  }
);

export const runAirwallexGooglePayFlow: RunOjsFlow<AirwallexGooglePayFlowCustomParams> =
  addBasicCheckoutCallbackHandlers(
    async ({
      context,
      checkoutPaymentMethod,
      nonCdeFormInputs,
      formCallbacks,
      customParams,
    }): Promise<SimpleOjsFlowResult> => {
      log__('Starting Google Pay flow...');
      const googlePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, GooglePayCpm);

      const anyCdeConnection = context.anyCdeConnection;
      const prefill = await getPrefill(anyCdeConnection);
      // Get processor account details
      const processorAccount = googlePayCpm.metadata;

      if (!processorAccount.processor_account_id) {
        throw new Error('No gateway merchant ID found in processor account');
      }

      const paymentDataRequest = getPaymentDataRequest({
        gateway: 'airwallex',
        gatewayMerchantId: processorAccount.processor_account_id,
        merchantName: processorAccount.processor_account_name,
        merchantId: processorAccount.google_pay_merchant_id ?? '',
        initialPreview: await getCheckoutPreviewAmount(
          anyCdeConnection,
          prefill.token,
          prefill.mode === 'setup',
          undefined
        ),
        overridePaymentRequest: customParams?.overridePaymentRequest,
      });

      const client = getGooglePaymentsClient(context.baseUrl, paymentDataRequest);

      try {
        const paymentData = await client.loadPaymentData(paymentDataRequest);
        log__('Google Pay Payment data', paymentData);

        // Merge form inputs with Google Pay data
        const mergedInputs = fillEmptyFormInputsWithGooglePay(nonCdeFormInputs, paymentData);
        const nonCdeFormFields = validateNonCdeFormFieldsForCC(
          mergedInputs,
          formCallbacks.get.onValidationError,
          customParams?.defaultFieldValues
        );

        // Extract encrypted payment token
        const encryptedPaymentToken = paymentData.paymentMethodData?.tokenizationData?.token;
        if (!encryptedPaymentToken) {
          throw new Error('No payment token received from Google Pay');
        }

        const startPaymentFlowResponse = await startPaymentFlow(anyCdeConnection, {
          payment_provider: checkoutPaymentMethod.provider,
          checkout_payment_method: checkoutPaymentMethod,
          new_customer_email: nonCdeFormFields[FieldName.EMAIL],
          new_customer_first_name: nonCdeFormFields[FieldName.FIRST_NAME],
          new_customer_last_name: nonCdeFormFields[FieldName.LAST_NAME],
          new_customer_address: {
            postal_code: nonCdeFormFields[FieldName.ZIP_CODE],
            country_code: nonCdeFormFields[FieldName.COUNTRY],
          },
        });

        // For Airwallex, we can assume it the requied_user_actions will be in this format
        const startFlowNextActions = parseAirwallexStartPaymentFlowResponse(startPaymentFlowResponse);
        log__('Start flow next actions', startFlowNextActions);

        // Always confirm payment flow, with or without 3DS
        const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
          secure_token: prefill.token,
          processor_specific_metadata: {
            payment_provider: checkoutPaymentMethod.provider,
            // GooglePay's encrypted_payment_token provided to verify the consent first
            airwallex_consent_id: startFlowNextActions?.consent_id,
            airwallex_payment_method_data: {
              type: 'googlepay',
              googlepay: {
                payment_data_type: 'encrypted_payment_token',
                encrypted_payment_token: encryptedPaymentToken,
              },
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
            their_pm_id: nextActionMetadata.their_pm_id,
            processor_specific_metadata: {
              payment_provider: checkoutPaymentMethod.provider,
              airwallex_consent_id: nextActionMetadata.consent_id,
            },
          });

          log__('[2nd] Confirm payment flow response', confirmResult);
          ourPmId = confirmResult.payment_methods?.[0]?.id;
        }

        if (!ourPmId) {
          throw new Error('No PM ID found');
        }

        if (prefill.mode === 'setup') {
          return { mode: 'setup', result: { payment_method_id: ourPmId } };
        } else {
          // Handle one-time payment flow
          log__(`Starting one-time payment flow...`);
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
            customer_first_name: nonCdeFormFields[FieldName.FIRST_NAME],
            customer_last_name: nonCdeFormFields[FieldName.LAST_NAME],
          };
          const result = await performCheckout(anyCdeConnection, checkoutRequest);
          return { mode: 'checkout', result };
        }
      } catch (err) {
        err__('Google Pay payment error', err);
        throw new Error((err as Error)?.message ?? 'Unknown error');
      }
    }
  );
