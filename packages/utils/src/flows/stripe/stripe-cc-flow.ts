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
import {
  AllFieldNames,
  ConfirmPaymentFlowResponse,
  FieldName,
  RequiredFormFields,
  TokenizeCardErrorResponse,
  TokenizeCardResponse,
} from '../../shared-models';
import { launchStripe3DSDialogFlow, Stripe3DSNextActionMetadata } from '../../stripe';
import { extractIssuesPerField } from '../../zod-errors';
import {
  addBasicCheckoutCallbackHandlers,
  createOjsFlowLoggers,
  OnValidationError,
  RunOjsFlow,
  SimpleOjsFlowResult,
} from '../ojs-flow';

// For gpay, apple pay, and stripe link:
// TODO ASAP override empty zip code logic
// if (!extraData[FieldName.ZIP_CODE]) {
//   log__('[flow] Overriding empty zip code (only for google pay, apple pay, and stripe link)');
//   extraData[FieldName.ZIP_CODE] = '00000';
// }

const { log__, err__ } = createOjsFlowLoggers('stripe-cc');

/*
 * Runs the main Stripe CC flow
 */
export const runStripeCcFlow: RunOjsFlow = addBasicCheckoutCallbackHandlers(
  async ({ context, checkoutPaymentMethod, nonCdeFormInputs, flowCallbacks }): Promise<SimpleOjsFlowResult> => {
    const anyCdeConnection = Array.from(context.cdeConnections.values())[0];
    const prefill = await getPrefill(anyCdeConnection);

    log__`Validating non-CDE form fields`;
    const nonCdeFormFields = validateNonCdeFormFields(nonCdeFormInputs, flowCallbacks.onValidationError);

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

          log__`Confirming payment flow`;
          const confirmResult = await confirmPaymentFlow(anyCdeConnection, {
            secure_token: prefill.token,
            existing_cc_pm_id: startPfResult.cc_pm_id,
          });
          const createdPaymentMethod = parsePaymentFlowConfirmation(confirmResult);

          if (prefill.mode === 'setup') {
            return { mode: 'setup', result: createdPaymentMethod };
          } else {
            const result = await checkoutCardElements(anyCdeConnection, {
              ...commonCheckoutParams,
              // Use the existing payment method ID from start_payment_flow
              existing_cc_pm_id: startPfResult.cc_pm_id,
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

/**
 * Parses and validates the payment flow confirmation response
 */
const parsePaymentFlowConfirmation = (response: ConfirmPaymentFlowResponse): { payment_method_id: string } => {
  if (response.payment_methods.length !== 1) {
    throw new Error(`Expected exactly one payment method, got ${response.payment_methods.length}`);
  }
  return { payment_method_id: response.payment_methods[0].id };
};

/**
 * Validates the non-CDE (non-sensitive) form fields
 */
const validateNonCdeFormFields = (
  nonCdeFormInputs: Record<string, unknown>,
  onValidationError: OnValidationError
): RequiredFormFields => {
  const payload = RequiredFormFields.safeParse(nonCdeFormInputs);
  if (!payload.success) {
    const formatted = payload.error.format();
    const issues = extractIssuesPerField(formatted);
    for (const [fieldName, errors] of Object.entries(issues)) {
      onValidationError(fieldName as FieldName, errors, fieldName);
    }
    log__('[flow][stripe-cc] Got validation errors in non-CDE form fields:', payload.data);
    throw new Error('Got validation errors in non-CDE form fields');
  }

  return payload.data;
};

/**
 * Validates the tokenizeCard CDE call result
 */
const validateTokenizeCardResults = (
  tokenizeResults: TokenizeCardResponse[],
  onValidationError: OnValidationError
): void => {
  for (const tokenizeResult of tokenizeResults) {
    if (tokenizeResult.success === false) {
      // Validation errors can also come from CDE (from the sensitive fields)
      onTokenizeResultValidationError(tokenizeResult, onValidationError);
      log__('[flow][stripe-cc] Error tokenizing card: got validation errors', tokenizeResult.errors);
      throw new Error('Got validation errors while tokenizing card');
    }
  }
};

/**
 * Calls onValidationErrors properly from the tokenizeCard CDE call
 */
const onTokenizeResultValidationError = (
  errorResponse: TokenizeCardErrorResponse,
  onValidationError: OnValidationError
) => {
  errorResponse.errors.forEach((error) => {
    const parsed = AllFieldNames.safeParse(error.elementType);
    if (!parsed.success) {
      err__('[flow][stripe-cc] Unknown field name in onValidationError:', error.elementType);
    } else {
      const fieldName = parsed.data;
      onValidationError(fieldName, error.errors);
    }
  });
  err__('[flow][stripe-cc] Error tokenizing card:', errorResponse.errors);
};

const parse3DSNextActionMetadata = (response: StartPaymentFlowForCCResponse): Stripe3DSNextActionMetadata => {
  if (response.required_user_actions.length !== 1) {
    throw new Error(
      `Error occurred.\nDetails: got ${response.required_user_actions.length} required user actions. Expecting only one action`
    );
  }
  return Stripe3DSNextActionMetadata.parse(response.required_user_actions[0]);
};
