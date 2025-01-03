import { z } from 'zod';
import { confirmPaymentFlow, getPrefill, startPaymentFlow } from '../../cde-client';
import { addBasicCheckoutCallbackHandlers, createOjsFlowLoggers, RunOjsFlow, SimpleOjsFlowResult } from '../ojs-flow';
import { createCustomerFieldsFromForm, performSimpleCheckoutOrSetup } from '../common/common-flow-utils';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
import { startPopupWindowVerificationStrict } from '../../3ds-elements/events';
import { parseVaultIdFrom3dsHref } from './pockyt-utils';

const { log__ } = createOjsFlowLoggers('pockyt-paypal');

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

    log__(`Starting payment flow...`);
    const startPaymentFlowResponse = await startPaymentFlow(anyCdeConnection, {
      payment_provider: cpm.provider,
      checkout_payment_method: cpm,
      ...newCustomerFields,
    });
    log__('Start payment flow response', startPaymentFlowResponse);
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
    });
    log__('Confirm payment flow result', confirmResult);

    return await performSimpleCheckoutOrSetup('pockyt-paypal', anyCdeConnection, cpm, nonCdeFormFields, confirmResult);
  }
);
