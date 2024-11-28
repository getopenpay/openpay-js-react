import { z } from 'zod';
import { getCheckoutPreviewAmount, getPrefill, performCheckout, startPaymentFlow } from '../../cde-client';
import {
  addBasicCheckoutCallbackHandlers,
  addErrorCatcherForInit,
  createOjsFlowLoggers,
  InitOjsFlow,
  InitOjsFlowResult,
  RunOjsFlow,
  SimpleOjsFlowResult,
} from '../ojs-flow';
import { findCpmMatchingType, overrideEmptyZipCode } from '../common/common-flow-utils';
import { PaymentMethod } from '@stripe/stripe-js';
import { createElementsOptions, createStripeElements, PaymentRequestNextActionMetadata } from '../../stripe';
import { OjsFlows } from '../all-flows';
import { createInputsDictFromForm, FieldName } from '../../..';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
import { CheckoutRequest, StartPaymentFlowResponse } from '../../cde_models';

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
    const { elements, stripe } = await createStripeElements(
      stripeLinkCpm.metadata.stripe_pk,
      createElementsOptions(initialPreview)
    );

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
      log__('Stripe Link button clicked. Validating form...');
      const nonCdeFormInputs = createInputsDictFromForm(context.formDiv);
      const cleanedFormInputs = overrideEmptyZipCode(nonCdeFormInputs);
      // TODO ASAP: maybe use stripe link billing details instead
      // If not filled properly, this calls onValidationError callbacks and then throws an error
      validateNonCdeFormFieldsForCC(cleanedFormInputs, flowCallbacks.onValidationError);
      event.resolve();
    });
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
      initResult,
    }): Promise<SimpleOjsFlowResult> => {
      log__(`Running Stripe PR flow...`);
      const anyCdeConnection = Array.from(context.cdeConnections.values())[0];

      console.log('TODO ASAP use these', customParams, initResult);

      log__(`Validating non-CDE form fields`);
      const cleanedFormInputs = overrideEmptyZipCode(nonCdeFormInputs);
      // TODO ASAP: maybe use stripe link billing details instead
      // If not filled properly, this calls onValidationError callbacks and then throws an error
      const nonCdeFormFields = validateNonCdeFormFieldsForCC(cleanedFormInputs, flowCallbacks.onValidationError);

      log__(`Starting payment flow...`);
      const startPaymentFlowResponse = await startPaymentFlow(anyCdeConnection, {
        payment_provider: checkoutPaymentMethod.provider,
        checkout_payment_method: checkoutPaymentMethod,
        existing_cc_pm_id: 'TODO ASAP',
      });
      const nextActionMetadata = parseStripeLinkNextActionMetadata(startPaymentFlowResponse);
      log__('nextActionMetadata', nextActionMetadata);

      log__(`Doing checkout...`);
      const prefill = await getPrefill(anyCdeConnection);
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
  );

// TODO ASAP: change the return type
const parseStripeLinkNextActionMetadata = (response: StartPaymentFlowResponse): PaymentRequestNextActionMetadata => {
  if (response.required_user_actions.length !== 1) {
    throw new Error(`Error occurred.\nDetails: got ${response.required_user_actions.length} required user actions`);
  }
  return PaymentRequestNextActionMetadata.parse(response.required_user_actions[0]);
};
