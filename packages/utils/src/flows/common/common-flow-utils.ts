import { z } from 'zod';
import { CheckoutPaymentMethod, ConfirmPaymentFlowResponse } from '../../shared-models';
import { createOjsFlowLoggers } from '../ojs-flow';

const { err__ } = createOjsFlowLoggers('commmon');

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
    err__(`No CPMs found for model ${zodModel}`);
    err__(allCPMs);
    err__(`zodModel`);
    throw new Error(`No CPMs found for model ${zodModel}`);
  }
  return zodModel.parse(cpm);
};
