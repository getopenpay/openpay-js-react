import { z } from 'zod';
import { confirmPaymentFlow, getPrefill, startPaymentFlow } from '../../cde-client';
import { addBasicCheckoutCallbackHandlers, createOjsFlowLoggers, RunOjsFlow, SimpleOjsFlowResult } from '../ojs-flow';
import { createCustomerFieldsFromForm } from '../common/common-flow-utils';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
import { startPopupWindowVerificationStrict } from '../../3ds-elements/events';
import { parseVaultIdFrom3dsHref } from './pockyt-utils';

const { log__, err__ } = createOjsFlowLoggers('pockyt-paypal');

// 👉 For convenience, you can use zod to define which CPMs are accepted by this flow
export const PockytPaypalCpm = z.object({
  processor_name: z.literal('pockyt'),
  provider: z.literal('paypal'),
});
export type PockytPaypalCpm = z.infer<typeof PockytPaypalCpm>;

// Checkout next_action_metadata in create_their_setup_intent
export const PockytPaypalRequiredUserActions = z
  .array(
    z.object({
      paypal_iframe_url: z.string(),
      verify_token: z.string(),
    })
  )
  .length(1);
export type PockytPaypalRequiredUserActions = z.infer<typeof PockytPaypalRequiredUserActions>;

/*
 * Runs the main Pockyt Paypal flow
 */
export const runPockytPaypalFlow: RunOjsFlow = addBasicCheckoutCallbackHandlers(
  async ({ context, checkoutPaymentMethod, nonCdeFormInputs, formCallbacks }): Promise<SimpleOjsFlowResult> => {
    log__(`Running Pockyt Paypal flow...`);
    const anyCdeConnection = context.anyCdeConnection;
    const prefill = await getPrefill(anyCdeConnection);

    log__(`Verifying CPM...`);
    const cpm = PockytPaypalCpm.parse(checkoutPaymentMethod);

    log__(`├ Validating non-CDE form fields`);
    const nonCdeFormFields = validateNonCdeFormFieldsForCC(nonCdeFormInputs, formCallbacks.get.onValidationError);
    const newCustomerFields = createCustomerFieldsFromForm(nonCdeFormFields);

    log__(`Starting payment flow... Mode: ${prefill.mode}`);
    // We use pay-first flow on checkout, and setup-only flow on setup
    const isPayFirstFlow = prefill.mode !== 'setup';
    const startPaymentFlowResponse = await startPaymentFlow(anyCdeConnection, {
      payment_provider: cpm.provider,
      checkout_payment_method: cpm,
      use_pay_first_flow: isPayFirstFlow,
      pay_first_flow_cart_info: isPayFirstFlow
        ? {
            // TODO add coupon and cart adjusted line items later
            line_items: prefill.line_items,
            displayed_total_amount_atom: prefill.amount_total_atom,
          }
        : undefined,
      ...newCustomerFields,
    });
    log__('Start payment flow response', startPaymentFlowResponse);
    if (!startPaymentFlowResponse.checkout_attempt_id) {
      err__('Checkout attempt ID not found in response:', startPaymentFlowResponse);
      throw new Error('An error occurred during checkout, please try again with another payment method.');
    }
    const nextActionMetadata = PockytPaypalRequiredUserActions.parse(startPaymentFlowResponse.required_user_actions)[0];

    log__(`Opening paypal iframe...`);
    const paypalFlowResult = await startPopupWindowVerificationStrict(
      'PayPal',
      anyCdeConnection,
      nextActionMetadata.verify_token,
      nextActionMetadata.paypal_iframe_url
    );
    log__('Paypal flow result', paypalFlowResult);
    const vaultId = parseVaultIdFrom3dsHref(paypalFlowResult.href);

    log__(`Confirming payment flow using vault ID ${vaultId}`);
    const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
      secure_token: prefill.token,
      their_pm_id: vaultId,
      checkout_attempt_id: isPayFirstFlow ? startPaymentFlowResponse.checkout_attempt_id : undefined,
    });
    log__('Confirm payment flow result', confirmResult);

    if (prefill.mode === 'setup') {
      return {
        mode: 'setup',
        result: {
          payment_method_id: confirmResult.payment_methods[0].id,
        },
      } satisfies SimpleOjsFlowResult;
    } else {
      if (!confirmResult.pay_first_success_response) {
        err__('Checkout failed, no pay-first success response:', confirmResult);
        throw new Error('Checkout failed, please try again with another payment method.');
      }
      return {
        mode: 'checkout',
        result: confirmResult.pay_first_success_response,
      } satisfies SimpleOjsFlowResult;
    }
  }
);
