import { startPaymentFlow, confirmPaymentFlow, performCheckout, updateCheckoutCustomer } from '../../../cde-client';
import { validateNonCdeFormFieldsForCC } from '../../common/cc-flow-utils';
import { fillEmptyFormInputsWithApplePay } from '../../common/apple-pay-utils';
import { SimpleOjsFlowResult } from '../../ojs-flow';
import { FieldName } from '../../../..';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function handleValidateMerchant(event: ApplePayJS.ApplePayValidateMerchantEvent, context: any) {
  try {
    const startPaymentFlowResponse = await startPaymentFlow(context.connection, {
      payment_provider: context.checkoutPaymentMethod.provider,
      checkout_payment_method: context.checkoutPaymentMethod,
      new_customer_email: 'dummy@email.com',
      new_customer_first_name: 'Dummy',
      new_customer_last_name: 'User',
      processor_specific_metadata: {
        apple_payment_session: {
          validation_url: event.validationURL,
          initiative_context: window.location.hostname,
          their_account_id: context.processorAccount.processor_account_id,
        },
      },
    });

    const merchantSession = startPaymentFlowResponse.required_user_actions?.[0]?.merchant_session;
    if (!merchantSession) {
      throw new Error('No merchant session received from payment flow');
    }

    context.session.completeMerchantValidation(merchantSession);
  } catch (err) {
    context.session.abort();
    throw err;
  }
}

export async function handlePaymentAuthorized(
  event: ApplePayJS.ApplePayPaymentAuthorizedEvent,
  context: any
): Promise<SimpleOjsFlowResult> {
  try {
    const paymentData = event.payment;
    const formInputs = fillEmptyFormInputsWithApplePay(context.nonCdeFormInputs, paymentData);
    const nonCdeFormFields = validateNonCdeFormFieldsForCC(formInputs, context.formCallbacks.get.onValidationError);

    await updateCheckoutCustomer(context.connection, {
      email: nonCdeFormFields[FieldName.EMAIL],
      first_name: nonCdeFormFields[FieldName.FIRST_NAME],
      last_name: nonCdeFormFields[FieldName.LAST_NAME],
      zip_code: nonCdeFormFields[FieldName.ZIP_CODE],
      country: nonCdeFormFields[FieldName.COUNTRY],
      update_processor_customer: true,
    });

    const confirmResult = await confirmPaymentFlow(context.connection, {
      secure_token: context.prefill.token,
      processor_specific_metadata: {
        payment_provider: context.checkoutPaymentMethod.provider,
        authnet_payment_data: {
          dataDescriptor: 'COMMON.APPLE.INAPP.PAYMENT',
          dataValue: window.btoa(JSON.stringify(paymentData.token.paymentData)),
        },
      },
    });

    const ourPmId = confirmResult.payment_methods?.[0]?.id;
    if (!ourPmId) {
      throw new Error('No PM ID found');
    }

    const result: ApplePayJS.ApplePayPaymentAuthorizationResult = {
      status: ApplePaySession.STATUS_SUCCESS,
    };
    context.session.completePayment(result);

    if (context.isSetupMode) {
      return { mode: 'setup', result: { payment_method_id: ourPmId } };
    } else {
      const result = await performCheckout(context.connection, {
        secure_token: context.prefill.token,
        payment_input: {
          provider_type: context.checkoutPaymentMethod.provider,
        },
        do_not_use_legacy_cc_flow: true,
        use_confirmed_pm_id: ourPmId,
        line_items: context.prefill.line_items,
        total_amount_atom: context.prefill.amount_total_atom,
        cancel_at_end: false,
        checkout_payment_method: context.checkoutPaymentMethod,
        customer_email: nonCdeFormFields[FieldName.EMAIL],
        customer_zip_code: nonCdeFormFields[FieldName.ZIP_CODE],
        customer_country: nonCdeFormFields[FieldName.COUNTRY],
        promotion_code: nonCdeFormFields[FieldName.PROMOTION_CODE],
        customer_first_name: nonCdeFormFields[FieldName.FIRST_NAME],
        customer_last_name: nonCdeFormFields[FieldName.LAST_NAME],
      });
      return { mode: 'checkout', result };
    }
  } catch (err) {
    const result: ApplePayJS.ApplePayPaymentAuthorizationResult = {
      status: ApplePaySession.STATUS_FAILURE,
    };
    context.session.completePayment(result);
    throw err;
  }
}
