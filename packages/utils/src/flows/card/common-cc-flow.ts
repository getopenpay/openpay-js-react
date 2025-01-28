import { z } from 'zod';
import { start3dsVerification } from '../../3ds-elements/events';
import {
  CdeError,
  checkoutCardElements,
  confirmPaymentFlow,
  getPrefill,
  setupCheckout,
  startPaymentFlowForCC,
  tokenizeCardOnAllConnections,
} from '../../cde-client';
import { CdeConnection } from '../../cde-connection';
import { StartPaymentFlowForCCRequest, StartPaymentFlowForCCResponse } from '../../cde_models';
import { Common3DSNextActionMetadata, ElementType, ThreeDSStatus } from '../../shared-models';
import { launchStripe3DSDialogFlow, Stripe3DSNextActionMetadata } from '../../stripe';
import { validateNonCdeFormFieldsForCC, validateTokenizeCardResults } from '../common/cc-flow-utils';
import { parseConfirmPaymentFlowResponse } from '../common/common-flow-utils';
import { addBasicCheckoutCallbackHandlers, createOjsFlowLoggers, RunOjsFlow, SimpleOjsFlowResult } from '../ojs-flow';
import { checkIfRequiresPockyt3ds, runPockyt3dsFlow } from '../pockyt/pockyt-utils';
import { checkIfRequiresAirwallex3ds, runAirwallex3dsFlow } from '../airwallex/airwallex-utils';

const { log__, err__ } = createOjsFlowLoggers('common-cc');
const { log__: stripeLog__ } = createOjsFlowLoggers('stripe-cc');

type CommonCcFlowParams = {
  /**
   * All of the current successful CDE connections.
   * This value may change between different calls to the flow, if the CDE iframes are still loading.
   */
  currentCdeConnections: Map<ElementType, CdeConnection>;
};

// Checkout next_action_metadata in create_their_setup_intent
export const PockytRequiredUserActions = z
  .array(
    z.object({
      our_existing_pm_id: z.string(),
    })
  )
  .length(1);
export type PockytRequiredUserActions = z.infer<typeof PockytRequiredUserActions>;

/*
 * Runs the main common CC flow
 */
export const runCommonCcFlow: RunOjsFlow<CommonCcFlowParams, undefined> = addBasicCheckoutCallbackHandlers(
  async ({
    context,
    checkoutPaymentMethod,
    nonCdeFormInputs,
    formCallbacks,
    customParams,
  }): Promise<SimpleOjsFlowResult> => {
    log__(`├ Running common CC flow...`, { checkoutPaymentMethod });
    const anyCdeConnection = context.anyCdeConnection;
    const prefill = await getPrefill(anyCdeConnection);

    log__(`├ Validating non-CDE form fields [Mode: ${prefill.mode}]`);
    const nonCdeFormFields = validateNonCdeFormFieldsForCC(nonCdeFormInputs, formCallbacks.get.onValidationError);

    const commonCheckoutParams: StartPaymentFlowForCCRequest = {
      session_id: context.elementsSessionId,
      checkout_payment_method: checkoutPaymentMethod,
      non_cde_form_fields: nonCdeFormFields,
      extra_metadata: {},
    };

    try {
      log__(`├ Tokenizing card info in CDE [Session: ${context.elementsSessionId}]`);

      // creates partial payment methods in CDE
      const tokenizeCardResults = await tokenizeCardOnAllConnections(customParams.currentCdeConnections, {
        session_id: context.elementsSessionId,
      });
      validateTokenizeCardResults(tokenizeCardResults, formCallbacks.get.onValidationError);

      if (prefill.mode === 'setup') {
        log__(`├ Setting up payment method in CDE [Token: ${prefill.token}]`);

        // this hits elements_router in cde /setup
        // 1. get partial payment method from CDE
        // 2. create customer for session
        // 3. partial payment method -> payment intput
        // 4. create card against all processors
        const result = await setupCheckout(anyCdeConnection, commonCheckoutParams);
        log__(`╰ Setup completed successfully [PM ID: ${result.payment_method_id}]`);
        return { mode: 'setup', result };
      } else {
        // this hits elements_router in cde /checkout
        // 1. create checkout subscriptions
        //   a. creating customer
        //   b. creating card against all processors
        //   c. create subscription
        log__(`├ Initial checkout flow. Checking out card info in CDE [Session: ${context.elementsSessionId}]`);
        const result = await checkoutCardElements(anyCdeConnection, commonCheckoutParams);
        log__(`╰ Checkout completed successfully.`);
        return { mode: 'checkout', result };
      }
    } catch (error) {
      if (error instanceof CdeError) {
        if (error.originalErrorMessage.includes('3DS_REQUIRED')) {
          log__(`├ Card requires 3DS, starting non-legacy payment flow`);
          log__('Received 3DS error response headers:', error.response.headers);

          // Pre-start-PF 3DS flows
          const requiresPockyt3ds = checkIfRequiresPockyt3ds(error.response.headers);
          if (requiresPockyt3ds) {
            log__(`├ Pockyt 3DS case detected. Going through Pockyt 3DS flow.`);
            const pockytMetadataForCheckout = await runPockyt3dsFlow(context.baseUrl, error.response.headers);
            commonCheckoutParams.extra_metadata['pockyt'] = pockytMetadataForCheckout;
          }

          const requiresAirwallex3ds = checkIfRequiresAirwallex3ds(error.response.headers);
          if (requiresAirwallex3ds) {
            log__(`├ Airwallex 3DS case detected. Going through Airwallex 3DS flow.`);
            const airwallexMetadataForCheckout = await runAirwallex3dsFlow(context.baseUrl, error.response.headers);
            commonCheckoutParams.extra_metadata['airwallex'] = airwallexMetadataForCheckout;
          }

          const startPfResult = await startPaymentFlowForCC(anyCdeConnection, commonCheckoutParams);
          log__(`├ Payment flow result:`, startPfResult);

          const preStart3dsComplete = requiresPockyt3ds || requiresAirwallex3ds;

          // Post-start-PF 3DS flows
          // TODO: refactor this to handle multiple processor 3DS flows
          const shouldUseStripeFlow = error.response.headers?.['op-should-use-new-flow'] !== 'true';
          if (!preStart3dsComplete) {
            if (shouldUseStripeFlow) {
              log__(`├ Using stripe 3DS flow`);
              await stripeCC3DSFlow(startPfResult);
            } else {
              log__(`├ Using common 3DS flow`);
              await commonCC3DSFlow(startPfResult, context.baseUrl);
            }
          } else {
            log__(`├ Pre-start 3DS is successful, other 3DS flows will be skipped.`);
          }
          const ccPmId = startPfResult.cc_pm_id;

          // TODO URGENT: ideally we also do confirmPaymentFlow for non-setup mode,
          // but for some reason 3DS_REQUIRED is thrown again during confirmPaymentFlow
          // even though the 3DS flow has been completed.
          if (prefill.mode === 'setup') {
            log__(`├ Confirming payment flow [cc_pm_id: ${ccPmId}]`);
            const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
              secure_token: prefill.token,
              existing_cc_pm_id: ccPmId,
            });
            log__(`├ Confirm payment flow result received Result:`, confirmResult);
            const createdPaymentMethod = parseConfirmPaymentFlowResponse(confirmResult);
            log__(`╰ Setup completed successfully [PM ID: ${createdPaymentMethod.payment_method_id}]`);
            return { mode: 'setup', result: createdPaymentMethod };
          } else {
            log__(`├ Checking out after 3DS flow [Flow: ${!shouldUseStripeFlow ? 'new' : 'legacy'}]`);
            const result = await checkoutCardElements(anyCdeConnection, {
              ...commonCheckoutParams,
              existing_cc_pm_id: ccPmId,
              do_not_use_legacy_cc_flow: shouldUseStripeFlow,
            });
            log__(`╰ Checkout completed successfully.`);
            return { mode: 'checkout', result };
          }
        }
      }
      err__(`╰ Error checking out card info in CDE`);
      err__(error);
      throw error;
    }
  }
);

/*
 * Parses the 3DS next action metadata from the start payment flow response
 */
const parseStripe3DSNextActionMetadata = (response: StartPaymentFlowForCCResponse): Stripe3DSNextActionMetadata => {
  // TODO: handle multiple processor 3ds
  const stripeAction = response.required_user_actions.find((action) => action.type === 'stripe_3ds');
  if (!stripeAction) {
    throw new Error('No stripe 3DS action found');
  }
  return Stripe3DSNextActionMetadata.parse(stripeAction);
};

export const parseCommon3DSNextActionMetadata = (
  response: StartPaymentFlowForCCResponse
): Common3DSNextActionMetadata => {
  // TODO: handle multiple processor 3ds
  const commonAction = response.required_user_actions.find((action) => action.type === 'airwallex_payment_consent');
  if (!commonAction) {
    throw new Error('No common 3DS action found');
  }
  return Common3DSNextActionMetadata.parse(commonAction);
};

const commonCC3DSFlow = async (startPfResult: StartPaymentFlowForCCResponse, baseUrl: string) => {
  const nextActionMetadata = parseCommon3DSNextActionMetadata(startPfResult);
  log__(`├ Using common 3DS flow [URL: ${nextActionMetadata.redirect_url}]`);

  const { status } = await start3dsVerification({ url: nextActionMetadata.redirect_url, baseUrl });
  log__(`╰ 3DS verification completed [Status: ${status}]`);
  if (status === ThreeDSStatus.CANCELLED) {
    throw new Error('3DS verification cancelled');
  }
  if (status === ThreeDSStatus.FAILURE) {
    throw new Error('3DS verification failed');
  }
};

const stripeCC3DSFlow = async (startPfResult: StartPaymentFlowForCCResponse) => {
  const nextActionMetadata = parseStripe3DSNextActionMetadata(startPfResult);
  stripeLog__(`├ Using stripe 3DS flow [Client Secret: ${nextActionMetadata.client_secret.substring(0, 8)}...]`);
  await launchStripe3DSDialogFlow(nextActionMetadata);
  stripeLog__('╰ Stripe 3DS flow completed successfully');
};
