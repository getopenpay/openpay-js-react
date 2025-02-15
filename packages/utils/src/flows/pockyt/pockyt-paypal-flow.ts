import { z } from 'zod';
import { confirmPaymentFlow, getPrefill } from '../../cde-client';
import { addBasicCheckoutCallbackHandlers, createOjsFlowLoggers, RunOjsFlow, SimpleOjsFlowResult } from '../ojs-flow';
import { createCustomerFieldsFromForm } from '../common/common-flow-utils';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
import { startPopupWindowVerificationStrict } from '../../3ds-elements/events';
import { parseArgFromHref, parseVaultIdFrom3dsHref } from './pockyt-utils';
import { SubmitSettings } from '../../models';
import { sleep } from '../../..';
import { v4 as uuidv4 } from 'uuid';

const { log__, err__ } = createOjsFlowLoggers('pockyt-paypal');

type PockytPaypalParams = {
  settings?: SubmitSettings<'pockyt-paypal'>;
};

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
export const runPockytPaypalFlow: RunOjsFlow<PockytPaypalParams> = addBasicCheckoutCallbackHandlers(
  async ({
    context,
    checkoutPaymentMethod,
    nonCdeFormInputs,
    formCallbacks,
    customParams,
  }): Promise<SimpleOjsFlowResult> => {
    log__(`Running Pockyt Paypal flow...`);
    const anyCdeConnection = context.anyCdeConnection;
    const prefill = await getPrefill(anyCdeConnection);

    log__(`Verifying CPM...`);
    const cpm = PockytPaypalCpm.parse(checkoutPaymentMethod);

    log__(`├ Validating non-CDE form fields`);
    const settings = customParams?.settings;
    const nonCdeFormFields = validateNonCdeFormFieldsForCC(
      nonCdeFormInputs,
      formCallbacks.get.onValidationError,
      settings?.defaultFieldValues
    );
    const newCustomerFields = createCustomerFieldsFromForm(nonCdeFormFields);

    log__(`Starting payment flow... Mode: ${prefill.mode}`);
    // We use pay-first flow on checkout, and setup-only flow on setup
    const frontendTokenForRedirectFlow = uuidv4();
    const isPayFirstFlow = prefill.mode !== 'setup';
    const startPaymentFlowRequest = {
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
      processor_specific_metadata: {
        use_paypal_redirect_flow: !!customParams?.settings?.useRedirectFlow,
        frontend_token_for_redirect_flow: frontendTokenForRedirectFlow,
      },
      ...newCustomerFields,
    };

    const preActionUrl = new URL('/app/pre-action/start/', context.baseUrl).toString();
    const encodedRequest = btoa(JSON.stringify(startPaymentFlowRequest));
    const redirectUrl = `${preActionUrl}?st=${prefill.token}&r=${encodedRequest}`;

    if (customParams?.settings?.useRedirectFlow) {
      log__('Starting redirect mode for PayPal...');
      window.location.href = redirectUrl;
      await sleep(20 * 1000);
      throw new Error('Paypal flow timed out, please try again with another payment method.');
    }

    // TODO ASAP: open pre-action in a modal here instead of doing SPFR
    // TODO ASAP: add redirect mode (cs urls, or internal)
    // TODO ASAP: generate token from frontend and then pass it
    // TODO ASAP: redirect to 3ds placeholder
    // TODO ASAP: still wait for popup window verification

    log__('Starting popup mode for PayPal...');

    log__(`Opening paypal iframe...`);
    const paypalFlowResult = await startPopupWindowVerificationStrict(
      'PayPal',
      anyCdeConnection,
      frontendTokenForRedirectFlow,
      redirectUrl
    );
    log__('Paypal flow result', paypalFlowResult);
    const vaultId = parseVaultIdFrom3dsHref(paypalFlowResult.href);
    const checkoutAttemptId = parseArgFromHref(paypalFlowResult.href, 'catt');

    if (!checkoutAttemptId) {
      err__('Checkout attempt ID not found in redirect URL:', paypalFlowResult.href);
      throw new Error('Checkout attempt ID not found in redirect URL');
    }

    log__(`Confirming payment flow using vault ID ${vaultId}`);
    const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
      secure_token: prefill.token,
      their_pm_id: vaultId,
      checkout_attempt_id: isPayFirstFlow ? checkoutAttemptId : undefined,
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
