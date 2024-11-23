import {
  CdeError,
  checkoutCardElements,
  confirmPaymentFlow,
  getPrefill,
  setupCheckout,
  startPaymentFlowForCC,
  tokenizeCard,
} from '../../cde-client';
import { StartPaymentFlowForCCResponse } from '../../cde_models';
import { launchStripe3DSDialogFlow, Stripe3DSNextActionMetadata } from '../../stripe';
import { validateNonCdeFormFieldsForCC, validateTokenizeCardResults } from '../common/cc-flow-utils';
import { parseConfirmPaymentFlowResponse } from '../common/common-flow-utils';
import { addBasicCheckoutCallbackHandlers, createOjsFlowLoggers, RunOjsFlow, SimpleOjsFlowResult } from '../ojs-flow';

const { log__, err__ } = createOjsFlowLoggers('stripe-cc');

/*
 * Runs the main Stripe CC flow
 */
export const runStripeCcFlow: RunOjsFlow = addBasicCheckoutCallbackHandlers(
  async ({ context, checkoutPaymentMethod, nonCdeFormInputs, flowCallbacks }): Promise<SimpleOjsFlowResult> => {
    log__`Running Stripe CC flow...`;
    const anyCdeConnection = Array.from(context.cdeConnections.values())[0];
    const prefill = await getPrefill(anyCdeConnection);

    log__`Validating non-CDE form fields`;
    const nonCdeFormFields = validateNonCdeFormFieldsForCC(nonCdeFormInputs, flowCallbacks.onValidationError);

    log__`Tokenizing card info in CDE`;
    const tokenizeCardResults = await tokenizeCard(context.cdeConnections, {
      session_id: context.elementsSessionId,
    });
    validateTokenizeCardResults(tokenizeCardResults, flowCallbacks.onValidationError);

    const commonCheckoutParams = {
      session_id: context.elementsSessionId,
      checkout_payment_method: checkoutPaymentMethod,
      non_cde_form_fields: nonCdeFormFields,
    };

    try {
      if (prefill.mode === 'setup') {
        log__`Setting up payment method in CDE`;
        const result = await setupCheckout(anyCdeConnection, commonCheckoutParams);
        return { mode: 'setup', result };
      } else {
        log__`Checking out card info in CDE`;
        const result = await checkoutCardElements(anyCdeConnection, commonCheckoutParams);
        return { mode: 'checkout', result };
      }
    } catch (error) {
      if (error instanceof CdeError) {
        if (error.originalErrorMessage === '3DS_REQUIRED') {
          log__`Card requires 3DS, starting non-legacy payment flow`;
          const startPfResult = await startPaymentFlowForCC(anyCdeConnection, commonCheckoutParams);
          const nextActionMetadata = parse3DSNextActionMetadata(startPfResult);

          log__`Launching Stripe 3DS dialog flow`;
          await launchStripe3DSDialogFlow(nextActionMetadata);

          // TODO ASAP: ideally we also do confirmPaymentFlow for non-setup mode,
          // but for some reason 3DS_REQUIRED is thrown again during confirmPaymentFlow
          // even though the 3DS flow has been completed.

          if (prefill.mode === 'setup') {
            log__`Confirming payment flow`;
            const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
              secure_token: prefill.token,
              existing_cc_pm_id: startPfResult.cc_pm_id,
            });
            const createdPaymentMethod = parseConfirmPaymentFlowResponse(confirmResult);
            return { mode: 'setup', result: createdPaymentMethod };
          } else {
            const result = await checkoutCardElements(anyCdeConnection, {
              ...commonCheckoutParams,
              // We use the existing payment method ID from start_payment_flow
              existing_cc_pm_id: startPfResult.cc_pm_id,
              do_not_use_legacy_cc_flow: true,
            });
            return { mode: 'checkout', result };
          }
        }
      }
      err__`Error checking out card info in CDE:`;
      err__(error);
      throw error;
    }
  }
);

/*
 * Parses the 3DS next action metadata from the start payment flow response
 */
const parse3DSNextActionMetadata = (response: StartPaymentFlowForCCResponse): Stripe3DSNextActionMetadata => {
  if (response.required_user_actions.length !== 1) {
    throw new Error(
      `Error occurred.\nDetails: got ${response.required_user_actions.length} required user actions. Expecting only one action`
    );
  }
  return Stripe3DSNextActionMetadata.parse(response.required_user_actions[0]);
};
