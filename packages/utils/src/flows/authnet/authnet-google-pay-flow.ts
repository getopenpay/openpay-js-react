import { createInputsDictFromForm, FieldName, FRAME_BASE_URL, OjsFlows } from '../../..';
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
  fillEmptyFormInputsWithGooglePay,
  getPaymentDataRequest,
  loadGooglePayScript,
  PaymentsClient,
} from '../common/google-pay-utils';
import { InitMobileWalletFlowResult, MobileWalletFlowCustomParams } from '../common/mobile-wallet-utils';
import { GooglePayCpm } from './authnet-utils';

const { log__, err__ } = createOjsFlowLoggers('authnet-gpay');

let paymentsClient: PaymentsClient | null = null;

const getGooglePaymentsClient = (baseUrl: string): PaymentsClient => {
  const environment = baseUrl === FRAME_BASE_URL ? 'PRODUCTION' : 'TEST';
  if (paymentsClient === null) {
    paymentsClient = new window.google!.payments.api.PaymentsClient({
      environment,
      merchantInfo: getPaymentDataRequest({
        gateway: 'authorizenet',
        gatewayMerchantId: '',
        merchantName: '',
      }).merchantInfo,
    });
  }
  return paymentsClient!;
};

export const initAuthnetGooglePayFlow: InitOjsFlow<InitMobileWalletFlowResult> = addErrorCatcherForInit(
  async ({ context, formCallbacks }) => {
    const googlePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, GooglePayCpm);
    if (!googlePayCpm) {
      return { isAvailable: false, isLoading: false, startFlow: async () => {} };
    }

    log__('Google Pay CPM', googlePayCpm);

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

    try {
      const { result: isReadyToPay } = await getGooglePaymentsClient(context.baseUrl).isReadyToPay(
        getPaymentDataRequest({
          gateway: 'authorizenet',
          gatewayMerchantId: processorAccount.processor_account_id,
          merchantName: processorAccount.processor_account_name,
          merchantId: processorAccount.google_pay_merchant_id ?? '',
        })
      );

      if (!isReadyToPay) {
        log__('Google Pay is not available for this user');
        return { isAvailable: false, isLoading: false, startFlow: async () => {} };
      }
    } catch (err) {
      err__('Error checking Google Pay availability', err);
      return { isAvailable: false, isLoading: false, startFlow: async () => {} };
    }

    const onGooglePayStartFlow = async (customParams?: MobileWalletFlowCustomParams) => {
      try {
        OjsFlows.authnetGooglePay.run({
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

export const runAuthnetGooglePayFlow: RunOjsFlow<MobileWalletFlowCustomParams> = addBasicCheckoutCallbackHandlers(
  async ({ context, nonCdeFormInputs, checkoutPaymentMethod, formCallbacks }): Promise<SimpleOjsFlowResult> => {
    const client = getGooglePaymentsClient(context.baseUrl);
    const anyCdeConnection = context.anyCdeConnection;
    const prefill = await getPrefill(anyCdeConnection);
    const googlePayCpm = findCpmMatchingType(context.checkoutPaymentMethods, GooglePayCpm);
    const processorAccount = googlePayCpm.metadata;
    const paymentDataRequest = getPaymentDataRequest({
      gateway: 'authorizenet',
      gatewayMerchantId: processorAccount.processor_account_id,
      merchantName: processorAccount.processor_account_name,
      merchantId: processorAccount.google_pay_merchant_id ?? '',
      initialPreview: await getCheckoutPreviewAmount(
        anyCdeConnection,
        prefill.token,
        prefill.mode === 'setup',
        undefined
      ),
    });

    try {
      const paymentData = await client.loadPaymentData(paymentDataRequest);
      log__('Google Pay Payment data', paymentData);

      const mergedInputs = fillEmptyFormInputsWithGooglePay(nonCdeFormInputs, paymentData);
      const nonCdeFormFields = validateNonCdeFormFieldsForCC(mergedInputs, formCallbacks.get.onValidationError);

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

      log__('Start payment flow response', startPaymentFlowResponse);

      const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
        secure_token: prefill.token,
        processor_specific_metadata: {
          payment_provider: checkoutPaymentMethod.provider,
          authnet_payment_data: {
            payment_type: 'google_pay',
            payment_token: encryptedPaymentToken,
          },
        },
      });

      const ourPmId = confirmResult.payment_methods?.[0]?.id;
      if (!ourPmId) {
        throw new Error('No PM ID found');
      }

      if (prefill.mode === 'setup') {
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
