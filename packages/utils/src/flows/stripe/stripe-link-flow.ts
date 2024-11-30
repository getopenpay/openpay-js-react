import { z } from 'zod';
import {
  confirmPaymentFlow,
  getCheckoutPreviewAmount,
  getPrefill,
  performCheckout,
  startPaymentFlow,
} from '../../cde-client';
import {
  addBasicCheckoutCallbackHandlers,
  addErrorCatcherForInit,
  createOjsFlowLoggers,
  InitOjsFlow,
  InitOjsFlowResult,
  RunOjsFlow,
  SimpleOjsFlowResult,
} from '../ojs-flow';
import { findCpmMatchingType, parseConfirmPaymentFlowResponse } from '../common/common-flow-utils';
import { PaymentMethod } from '@stripe/stripe-js';
import { createStripeElements } from '../../stripe';
import { OjsFlows } from '../all-flows';
import { createInputsDictFromForm, FieldName } from '../../..';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
import { CheckoutRequest } from '../../cde_models';

const OJS_STRIPE_LINK_BTN_ID = 'ojs-stripe-link-btn';

const { log__, err__ } = createOjsFlowLoggers('stripe-link');

type RunStripeLinkFlowParams = {
  stripePM: PaymentMethod;
};

export const StripeLinkCpm = z.object({
  provider: z.literal('stripe_link'),
  processor_name: z.literal('stripe'),
  metadata: z.object({
    stripe_pk: z.string(),
  }),
});
export type StripeLinkCpm = z.infer<typeof StripeLinkCpm>;

// Checkout next_action_metadata in create_their_setup_intent
export const StripeLinkRequiredUserActions = z
  .array(
    z.object({
      our_existing_pm_id: z.string(),
    })
  )
  .length(1);
export type StripeLinkRequiredUserActions = z.infer<typeof StripeLinkRequiredUserActions>;

/*
 * Initializes the Stripe link flow (put more details here)
 */
export const initStripeLinkFlow: InitOjsFlow<InitOjsFlowResult> = addErrorCatcherForInit(
  async ({ context, flowCallbacks }): Promise<InitOjsFlowResult> => {
    log__(`Checking if there are any CPMs for Stripe PR...`);
    const stripeLinkCpm = findCpmMatchingType(context.checkoutPaymentMethods, StripeLinkCpm);

    log__(`Starting stripe link flow...`);
    const anyCdeConnection = Array.from(context.cdeConnections.values())[0];
    const prefill = await getPrefill(anyCdeConnection);
    const isSetupMode = prefill.mode === 'setup';

    log__(`Creating stripe elements...`);
    const initialPreview = await getCheckoutPreviewAmount(anyCdeConnection, prefill.token, isSetupMode, undefined);
    const { elements, stripe } = await createStripeElements(stripeLinkCpm.metadata.stripe_pk, {
      mode: 'setup',
      currency: initialPreview.currency,
      setup_future_usage: 'off_session',
      paymentMethodCreation: 'manual',
    });

    log__(`Mounting payment element...`);
    const expressCheckoutElement = elements.create('expressCheckout', {
      buttonHeight: context.customInitParams.stripeLink?.buttonHeight,
      paymentMethods: {
        amazonPay: 'never',
        applePay: 'never',
        googlePay: 'never',
        paypal: 'never',
      },
    });
    expressCheckoutElement.mount(`#${OJS_STRIPE_LINK_BTN_ID}`);
    expressCheckoutElement.on('click', async (event) => {
      log__('Stripe Link button clicked');
      event.resolve();
    });
    // TODO ASAP: add on click handler so oddsjam can either block or override the click
    expressCheckoutElement.on('confirm', async (event) => {
      log__('Stripe Link window confirmed', event);
      const result = await stripe.createPaymentMethod({
        elements,
        params: {
          billing_details: event.billingDetails,
        },
      });
      if (result.error) {
        err__('error', result.error);
        flowCallbacks.onCheckoutError(result.error.message ?? 'Stripe Link unknown error');
      } else {
        log__('paymentMethod', result.paymentMethod);
        OjsFlows.stripeLink.run({
          context,
          checkoutPaymentMethod: stripeLinkCpm,
          nonCdeFormInputs: createInputsDictFromForm(context.formDiv),
          flowCallbacks,
          customParams: { stripePM: result.paymentMethod },
          initResult: { isAvailable: true },
        });
      }
    });

    return { isAvailable: true };
  }
);

/*
 * Runs the main Stripe link flow
 */
export const runStripeLinkFlow: RunOjsFlow<RunStripeLinkFlowParams, InitOjsFlowResult> =
  addBasicCheckoutCallbackHandlers(
    async ({
      context,
      checkoutPaymentMethod,
      nonCdeFormInputs,
      flowCallbacks,
      customParams,
    }): Promise<SimpleOjsFlowResult> => {
      log__(`Running Stripe PR flow...`);
      const anyCdeConnection = Array.from(context.cdeConnections.values())[0];

      log__(`Merging PM fields with form fields...`);
      const mergedInputs = fillEmptyFormInputsWithStripePM(nonCdeFormInputs, customParams.stripePM);
      const nonCdeFormFields = validateNonCdeFormFieldsForCC(mergedInputs, flowCallbacks.onValidationError);

      log__(`Starting payment flow...`);
      const startPaymentFlowResponse = await startPaymentFlow(anyCdeConnection, {
        payment_provider: checkoutPaymentMethod.provider,
        checkout_payment_method: checkoutPaymentMethod,
        their_existing_pm_id: customParams.stripePM.id,
      });
      log__('Start payment flow response', startPaymentFlowResponse);
      const nextActionMetadata = StripeLinkRequiredUserActions.parse(startPaymentFlowResponse.required_user_actions);
      // Start payment flow for stripe link creates a new OpenPay PM from the Stripe PM
      const ourExistingPmId = nextActionMetadata[0].our_existing_pm_id;

      const prefill = await getPrefill(anyCdeConnection);

      if (prefill.mode === 'setup') {
        log__(`Doing payment setup...`);
        const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
          secure_token: prefill.token,
          existing_cc_pm_id: ourExistingPmId,
        });
        const createdPaymentMethod = parseConfirmPaymentFlowResponse(confirmResult);
        // TODO ASAP: check if this works
        return { mode: 'setup', result: createdPaymentMethod };
      } else {
        log__(`Doing checkout...`);
        const checkoutRequest: CheckoutRequest = {
          secure_token: prefill.token,
          payment_input: {
            provider_type: checkoutPaymentMethod.provider,
          },
          customer_email: nonCdeFormFields[FieldName.EMAIL],
          customer_zip_code: nonCdeFormFields[FieldName.ZIP_CODE],
          customer_country: nonCdeFormFields[FieldName.COUNTRY],
          promotion_code: nonCdeFormFields[FieldName.PROMOTION_CODE],
          line_items: prefill.line_items,
          total_amount_atom: prefill.amount_total_atom,
          cancel_at_end: false,
          checkout_payment_method: checkoutPaymentMethod,
        };
        const result = await performCheckout(anyCdeConnection, checkoutRequest);
        return { mode: 'checkout', result };
      }
    }
  );

const fillEmptyFormInputsWithStripePM = (
  formInputs: Record<string, unknown>,
  stripePm: PaymentMethod
): Record<string, unknown> => {
  const inputs = { ...formInputs };

  // Try splitting full name into first and last
  const [payerFirstName, ...payerLastNameParts] = stripePm.billing_details.name?.trim()?.split(/\s+/) ?? []; // Note that first name can also be undefined
  const payerLastName = payerLastNameParts.join(' ') || undefined; // Force blank strings to be undefined

  // Note: we use ||, not ?? to ensure that blanks are falsish
  inputs[FieldName.FIRST_NAME] = inputs[FieldName.FIRST_NAME] || payerFirstName || '_OP_UNKNOWN';
  inputs[FieldName.LAST_NAME] = inputs[FieldName.LAST_NAME] || payerLastName || '_OP_UNKNOWN';
  inputs[FieldName.EMAIL] =
    inputs[FieldName.EMAIL] ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stripePm as any)['link']?.email ||
    stripePm.billing_details.email ||
    'op_unfilled@getopenpay.com';
  inputs[FieldName.ZIP_CODE] = inputs[FieldName.ZIP_CODE] || stripePm.billing_details.address?.postal_code || '00000';
  inputs[FieldName.COUNTRY] = inputs[FieldName.COUNTRY] || stripePm.billing_details.address?.country || 'US';

  log__(`Final form inputs:`, inputs);
  return inputs;
};
