import { z } from 'zod';
import { startPaymentFlow } from '../../cde-client';
import { addBasicCheckoutCallbackHandlers, createOjsFlowLoggers, RunOjsFlow, SimpleOjsFlowResult } from '../ojs-flow';
import { createCustomerFieldsFromForm, performSimpleCheckoutOrSetup } from '../common/common-flow-utils';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
import { startIframeFlowStrict } from '../../3ds-elements/events';

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
    const nextActionMetadata = PockytPaypalRequiredUserActions.parse(startPaymentFlowResponse.required_user_actions);

    log__(`Opening paypal iframe...`);
    const paypalFlowResult = await startIframeFlowStrict({
      url: nextActionMetadata[0].paypal_iframe_url,
      baseUrl: context.baseUrl,
    });
    log__('Paypal flow result', paypalFlowResult);

    return await performSimpleCheckoutOrSetup('pockyt-paypal', anyCdeConnection, cpm, nonCdeFormFields);
  }
);
