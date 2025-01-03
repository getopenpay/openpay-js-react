import { z } from 'zod';
import { CheckoutPaymentMethod, ConfirmPaymentFlowResponse, FieldName, RequiredFormFields } from '../../shared-models';
import { createOjsFlowLoggers, SimpleOjsFlowResult } from '../ojs-flow';
import { CheckoutRequest, NewCustomerFields } from '../../cde_models';
import { CdeConnection } from '../../cde-connection';
import { finalizeSetupPaymentMethod, getPrefill, performCheckout } from '../../cde-client';

const { log__, err__ } = createOjsFlowLoggers('common');

export type Loadable<T> =
  | {
      status: 'loading';
    }
  | {
      status: 'loaded';
      result: T;
    }
  | {
      status: 'error';
      message: string;
    };

/**
 * Parses and validates the payment flow confirmation response
 * Ensures that there is exactly one payment method in the response
 */
export const parseConfirmPaymentFlowResponse = (
  response: ConfirmPaymentFlowResponse
): { payment_method_id: string } => {
  if (response.payment_methods.length !== 1) {
    throw new Error(`Expected exactly one payment method, got ${response.payment_methods.length}`);
  }
  return { payment_method_id: response.payment_methods[0].id };
};

export const findCpmMatchingType = <T>(allCPMs: CheckoutPaymentMethod[], zodModel: z.ZodSchema<T>): T => {
  const cpm = allCPMs.find((cpm) => zodModel.safeParse(cpm).success);
  if (!cpm) {
    err__(`No CPMs found for model. All models:`, allCPMs);
    throw new Error(`No CPMs found for model`);
  }
  return zodModel.parse(cpm);
};

export const overrideEmptyZipCode = (formInputs: Record<string, unknown>): Record<string, unknown> => {
  const newFormInputs = { ...formInputs };
  if (!newFormInputs[FieldName.ZIP_CODE]) {
    log__(`Overriding empty zip code`);
    newFormInputs[FieldName.ZIP_CODE] = '00000';
  }
  return newFormInputs;
};

export const createCustomerFieldsFromForm = (fields: RequiredFormFields): NewCustomerFields => {
  return {
    new_customer_email: fields.email,
    new_customer_address: {
      zip_code: fields.zipCode,
      country: fields.country,
    },
    new_customer_first_name: fields.firstName,
    new_customer_last_name: fields.lastName,
  };
};

export const performSimpleCheckoutOrSetup = async (
  logPrefix: string,
  anyCdeConnection: CdeConnection,
  checkoutPaymentMethod: CheckoutPaymentMethod,
  requiredFormFields: RequiredFormFields,
  confirmResult: ConfirmPaymentFlowResponse
): Promise<SimpleOjsFlowResult> => {
  const { log__ } = createOjsFlowLoggers(logPrefix);
  const prefill = await getPrefill(anyCdeConnection);

  const createdPaymentMethod = parseConfirmPaymentFlowResponse(confirmResult);

  if (prefill.mode === 'setup') {
    log__(`Setting up payment method...`);

    const setupResult = await finalizeSetupPaymentMethod(anyCdeConnection, {
      secure_token: prefill.token,
      pm_id: createdPaymentMethod.payment_method_id,
    });
    return { mode: 'setup', result: setupResult };
  } else {
    log__(`Doing checkout...`);
    const checkoutRequest: CheckoutRequest = {
      secure_token: prefill.token,
      payment_input: {
        provider_type: checkoutPaymentMethod.provider,
      },
      customer_email: requiredFormFields[FieldName.EMAIL],
      customer_zip_code: requiredFormFields[FieldName.ZIP_CODE],
      customer_country: requiredFormFields[FieldName.COUNTRY],
      promotion_code: requiredFormFields[FieldName.PROMOTION_CODE],
      line_items: prefill.line_items,
      total_amount_atom: prefill.amount_total_atom,
      cancel_at_end: false,
      checkout_payment_method: checkoutPaymentMethod,
      use_confirmed_pm_id: createdPaymentMethod.payment_method_id,
    };
    const result = await performCheckout(anyCdeConnection, checkoutRequest);
    return { mode: 'checkout', result };
  }
};
