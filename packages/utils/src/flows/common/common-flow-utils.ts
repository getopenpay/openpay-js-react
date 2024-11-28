import { z } from 'zod';
import { CheckoutPaymentMethod, ConfirmPaymentFlowResponse, FieldName } from '../../shared-models';
import { createOjsFlowLoggers } from '../ojs-flow';

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
