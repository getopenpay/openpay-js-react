import { z } from 'zod';
import {
  addBasicCheckoutCallbackHandlers,
  addErrorCatcherForInit,
  createOjsFlowLoggers,
  InitOjsFlow,
  RunOjsFlow,
  SimpleOjsFlowResult,
} from '../ojs-flow';
import { PaymentRequest } from '@stripe/stripe-js';
import {
  confirmStripePrPM,
  createStripePaymentRequest,
  PaymentRequestNextActionMetadata,
  waitForUserToAddPaymentMethod,
} from '../../stripe';
import {
  confirmPaymentFlow,
  getCheckoutPreviewAmount,
  getPrefill,
  performCheckout,
  startPaymentFlowForPR,
} from '../../cde-client';
import { Amount, FieldName } from '../../shared-models';
import { validateNonCdeFormFieldsForCC } from '../common/cc-flow-utils';
import { CheckoutRequest, StartPaymentFlowResponse } from '../../cde_models';
import { findCpmMatchingType, parseConfirmPaymentFlowResponse } from '../common/common-flow-utils';

const { log__, err__ } = createOjsFlowLoggers('stripe-pr');

export type InitStripePrFlowSuccess = {
  isAvailable: true;
  // Passed to RunFlow
  pr: PaymentRequest;
  // Passed to the user
  availableProviders: {
    applePay: boolean;
    googlePay: boolean;
  };
};
export type InitStripePrFlowResult =
  | InitStripePrFlowSuccess
  | {
      isAvailable: false;
      reason: string;
    };

export type StripePrFlowCustomParams = {
  provider: 'apple_pay' | 'google_pay';
  overridePaymentRequest?: {
    amount: Amount;
    pending: boolean;
  };
};

export const StripePrCpm = z.object({
  provider: z.union([z.literal('apple_pay'), z.literal('google_pay')]),
  processor_name: z.literal('stripe'),
  metadata: z.object({
    stripe_pk: z.string(),
  }),
});
export type StripePrCpm = z.infer<typeof StripePrCpm>;

/*
 * Initializes the Stripe PaymentRequest flow (apple pay, google pay)
 */
export const initStripePrFlow: InitOjsFlow<InitStripePrFlowResult> = addErrorCatcherForInit(
  async ({ context }): Promise<InitStripePrFlowResult> => {
    log__(`Checking if there are any CPMs for Stripe PR...`);
    const checkoutPaymentMethod = findCpmMatchingType(context.checkoutPaymentMethods, StripePrCpm);

    log__(`Initializing Stripe PR flow...`);
    const anyCdeConnection = Array.from(context.cdeConnections.values())[0];
    const prefill = await getPrefill(anyCdeConnection);
    const isSetupMode = prefill.mode === 'setup';

    log__(`Getting initial preview amount`);
    const initialPreview = await getCheckoutPreviewAmount(anyCdeConnection, prefill.token, isSetupMode, undefined);
    // We initialize just one global payment request. Apple pay does NOT like having multiple PR objects.
    const pr = await createStripePaymentRequest(
      checkoutPaymentMethod.metadata.stripe_pk,
      initialPreview.amountAtom,
      initialPreview.currency,
      isSetupMode
    );

    log__(`Checking if can make payment`);
    const canMakePayment = await pr.canMakePayment();
    if (canMakePayment === null) {
      err__(`canMakePayment returned null`);
      return { isAvailable: false, reason: 'canMakePayment returned null' };
    }

    log__(`Stripe PR flow initialized successfully. Can make payment`, canMakePayment);
    return {
      isAvailable: true,
      pr,
      availableProviders: {
        applePay: canMakePayment.applePay,
        googlePay: canMakePayment.googlePay,
      },
    };
  }
);

/*
 * Runs the main Stripe PaymentRequest flow
 */
export const runStripePrFlow: RunOjsFlow<StripePrFlowCustomParams, InitStripePrFlowSuccess> =
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
      if (customParams.provider !== checkoutPaymentMethod.provider) {
        throw new Error(`Provider mismatch. Expected ${customParams.provider}, got ${checkoutPaymentMethod.provider}`);
      }
      const anyCdeConnection = Array.from(context.cdeConnections.values())[0];
      const pr = initResult.pr;

      log__(`Validating non-CDE form fields`);
      const cleanedFormInputs = overrideEmptyZipCode(nonCdeFormInputs);
      const nonCdeFormFields = validateNonCdeFormFieldsForCC(cleanedFormInputs, flowCallbacks.onValidationError);

      // TODO: adjust PR amounts as coupons are applied
      if (customParams?.overridePaymentRequest) {
        const override = customParams.overridePaymentRequest;
        log__(`Overriding PR amount with`, override);
        updatePrWithAmount(pr, override.amount, override.pending);
      }

      // 🤚 IMPORTANT: do NOT do any async operations before this point, as Apple and Google Pay
      // require pr.show() to be called as soon as possible after the click event
      log__(`Showing PR dialog...`);
      pr.show();
      const stripePmAddedEvent = await waitForUserToAddPaymentMethod(pr);

      log__(`PR dialog finished. Starting payment flow...`);
      const startPaymentFlowResponse = await startPaymentFlowForPR(anyCdeConnection, {
        fields: nonCdeFormFields,
        checkoutPaymentMethod,
      });
      const nextActionMetadata = parsePRNextActionMetadata(startPaymentFlowResponse);

      log__(`Confirming PR with Stripe...`);
      await confirmStripePrPM(nextActionMetadata, stripePmAddedEvent);

      const prefill = await getPrefill(anyCdeConnection);
      if (prefill.mode === 'setup') {
        log__(`Confirming payment flow for setup...`);
        const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
          secure_token: prefill.token,
        });
        const createdPaymentMethod = parseConfirmPaymentFlowResponse(confirmResult);
        // TODO ASAP: check if this works
        return { mode: 'setup', result: createdPaymentMethod };
      } else {
        log__(`Performing checkout...`);
        // TODO ASAP: refactor this
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

const overrideEmptyZipCode = (formInputs: Record<string, unknown>): Record<string, unknown> => {
  const newFormInputs = { ...formInputs };
  if (!newFormInputs[FieldName.ZIP_CODE]) {
    log__(`Overriding empty zip code (only for google pay and apple pay)`);
    newFormInputs[FieldName.ZIP_CODE] = '00000';
  }
  return newFormInputs;
};

const updatePrWithAmount = (pr: PaymentRequest, amount: Amount, isPending: boolean): void => {
  pr.update({
    total: {
      amount: amount.amountAtom,
      label: 'Total',
      pending: isPending,
    },
    currency: amount.currency,
  });
};

const parsePRNextActionMetadata = (response: StartPaymentFlowResponse): PaymentRequestNextActionMetadata => {
  if (response.required_user_actions.length !== 1) {
    throw new Error(`Error occurred.\nDetails: got ${response.required_user_actions.length} required user actions`);
  }
  return PaymentRequestNextActionMetadata.parse(response.required_user_actions[0]);
};