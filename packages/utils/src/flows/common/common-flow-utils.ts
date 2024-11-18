import { ConfirmPaymentFlowResponse } from '../../shared-models';

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
