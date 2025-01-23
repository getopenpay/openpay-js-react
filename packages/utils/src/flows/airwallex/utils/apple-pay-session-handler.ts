import { CheckoutPaymentMethod, PaymentFormPrefill } from '../../../cde_models';
import { startPaymentFlow, confirmPaymentFlow, performCheckout } from '../../../cde-client';
import { start3dsVerification } from '../../../3ds-elements/events';
import { validateNonCdeFormFieldsForCC } from '../../common/cc-flow-utils';
import { fillEmptyFormInputsWithApplePay } from './apple-pay.utils';
import { createOjsFlowLoggers } from '../../ojs-flow';
import { SimpleOjsFlowResult } from '../../ojs-flow';
import { FormCallbacks } from '../../../form-callbacks';
import { CdeConnection, CommonNextActionMetadata, FieldName } from '../../../..';
import { ThreeDSStatus } from '../../../..';
import { AirwallexProcessorMetadata } from '../types/google-pay.types';

const { log__ } = createOjsFlowLoggers('applepay-session');

export type SessionContext = {
  session: ApplePaySession;
  connection: CdeConnection;
  checkoutPaymentMethod: CheckoutPaymentMethod;
  nonCdeFormInputs: Record<string, unknown>;
  processorAccount: AirwallexProcessorMetadata;
  prefill: PaymentFormPrefill;
  isSetupMode: boolean;
  baseUrl: string;
  formCallbacks: FormCallbacks;
};

export async function handleValidateMerchant(
  event: ApplePayJS.ApplePayValidateMerchantEvent,
  context: SessionContext
): Promise<string> {
  try {
    const startPaymentFlowResponse = await startPaymentFlow(context.connection, {
      payment_provider: context.checkoutPaymentMethod.provider,
      checkout_payment_method: context.checkoutPaymentMethod,
      new_customer_email: context.nonCdeFormInputs[FieldName.EMAIL] as string,
      new_customer_first_name: context.nonCdeFormInputs[FieldName.FIRST_NAME] as string,
      new_customer_last_name: context.nonCdeFormInputs[FieldName.LAST_NAME] as string,
      airwallex_payment_session: {
        validation_url: event.validationURL,
        initiative_context: window.location.hostname,
        their_account_id: context.processorAccount.processor_account_id,
      },
    });

    const paymentSessionResponse = startPaymentFlowResponse.required_user_actions.find(
      (action) => Object.keys(action)[0] === 'payment_session'
    );
    const consentId = startPaymentFlowResponse.required_user_actions[0].consent_id;

    if (!paymentSessionResponse) {
      throw new Error('No session data received from payment flow');
    }

    context.session.completeMerchantValidation(paymentSessionResponse['payment_session']);
    return consentId;
  } catch (err) {
    context.session.abort();
    throw err;
  }
}

async function handle3DS(
  nextActionMetadata: CommonNextActionMetadata,
  context: SessionContext
): Promise<string | undefined> {
  if (!nextActionMetadata.redirect_url) {
    throw new Error('No redirect URL found');
  }
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

  // confirm flow again
  const confirmResult = await confirmPaymentFlow(context.connection, {
    secure_token: context.prefill.token,
    airwallex_consent_id: nextActionMetadata.consent_id,
    payment_provider: context.checkoutPaymentMethod.provider,
    their_pm_id: nextActionMetadata.their_pm_id,
  });

  log__('[2nd] Confirm payment flow response', confirmResult);
  return confirmResult.payment_methods?.[0]?.id;
}

async function performCheckoutWithPmId(
  ourPmId: string,
  nonCdeFormFields: Record<string, unknown>,
  context: SessionContext
): Promise<SimpleOjsFlowResult> {
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
    customer_email: nonCdeFormFields[FieldName.EMAIL] as string,
    customer_zip_code: nonCdeFormFields[FieldName.ZIP_CODE] as string,
    customer_country: nonCdeFormFields[FieldName.COUNTRY] as string,
    promotion_code: nonCdeFormFields[FieldName.PROMOTION_CODE] as string,
  });

  return { mode: 'checkout', result };
}

export async function handlePaymentAuthorized(
  event: ApplePayJS.ApplePayPaymentAuthorizedEvent,
  context: SessionContext,
  consentId: string
): Promise<SimpleOjsFlowResult> {
  try {
    const paymentData = event.payment;
    const formInputs = fillEmptyFormInputsWithApplePay(context.nonCdeFormInputs, paymentData.billingContact);
    const nonCdeFormFields = validateNonCdeFormFieldsForCC(formInputs, context.formCallbacks.get.onValidationError);

    const confirmResult = await confirmPaymentFlow(context.connection, {
      secure_token: context.prefill.token,
      payment_provider: context.checkoutPaymentMethod.provider,
      airwallex_consent_id: consentId,
      airwallex_payment_method_data: {
        type: 'applepay',
        applepay: {
          payment_data_type: 'encrypted_payment_token',
          encrypted_payment_token: paymentData.token,
        },
      },
    });

    log__('[1st] Confirm payment flow response', confirmResult);
    let ourPmId: string | undefined = confirmResult.payment_methods?.[0]?.id;

    const nextActionMetadata = confirmResult.required_user_actions?.find(
      (action) => action.type === 'airwallex_payment_consent'
    );

    if (nextActionMetadata?.redirect_url && nextActionMetadata.consent_id && nextActionMetadata.their_pm_id) {
      ourPmId = await handle3DS(nextActionMetadata, context);
    }

    if (!ourPmId) {
      throw new Error('No PM ID found');
    }

    context.session.completePayment(ApplePaySession.STATUS_SUCCESS);

    return context.isSetupMode
      ? { mode: 'setup', result: { payment_method_id: ourPmId } }
      : await performCheckoutWithPmId(ourPmId, nonCdeFormFields, context);
  } catch (err) {
    context.session.completePayment(ApplePaySession.STATUS_FAILURE);
    throw err;
  }
}
