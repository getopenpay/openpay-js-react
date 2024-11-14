import { checkoutCardElements, getPrefill, setupCheckout, tokenizeCard } from '../../cde-client';
import {
  AllFieldNames,
  FieldName,
  RequiredFormFields,
  TokenizeCardErrorResponse,
  TokenizeCardResponse,
} from '../../shared-models';
import { extractIssuesPerField } from '../../zod-errors';
import { addBasicCheckoutCallbackHandlers, OnValidationError, RunOjsFlow, SimpleOjsFlowResult } from '../ojs-flow';

// For gpay, apple pay, and stripe link:
// TODO ASAP override empty zip code logic
// if (!extraData[FieldName.ZIP_CODE]) {
//   console.log('[flow] Overriding empty zip code (only for google pay, apple pay, and stripe link)');
//   extraData[FieldName.ZIP_CODE] = '00000';
// }

/*
 * Runs the main Stripe CC flow
 */
export const runStripeCcFlow: RunOjsFlow = addBasicCheckoutCallbackHandlers(
  async ({ context, checkoutPaymentMethod, nonCdeFormInputs, flowCallbacks }): Promise<SimpleOjsFlowResult> => {
    const anyCdeConnection = Array.from(context.cdeConnections.values())[0];
    const prefill = await getPrefill(anyCdeConnection);

    console.log('[flow] Validating non-CDE form fields');
    const nonCdeFormFields = validateNonCdeFormFields(nonCdeFormInputs, flowCallbacks.onValidationError);

    console.log('[flow][stripe-cc] Tokenizing card info in CDE');
    const tokenizeCardResults = await tokenizeCard(context.cdeConnections, {
      session_id: context.elementsSessionId,
    });
    validateTokenizeCardResults(tokenizeCardResults, flowCallbacks.onValidationError);

    try {
      if (prefill.mode === 'setup') {
        console.log('[flow][stripe-cc] Setting up payment method in CDE');
        const setupResult = await setupCheckout(anyCdeConnection, {
          session_id: context.elementsSessionId,
          checkout_payment_method: checkoutPaymentMethod,
          non_cde_form_fields: nonCdeFormFields,
        });
        return {
          mode: 'setup',
          result: setupResult,
        };
      } else {
        console.log('[flow][stripe-cc] Checking out card info in CDE');
        const checkoutResult = await checkoutCardElements(anyCdeConnection, {
          session_id: context.elementsSessionId,
          checkout_payment_method: checkoutPaymentMethod,
          non_cde_form_fields: nonCdeFormFields,
        });
        return {
          mode: 'checkout',
          result: checkoutResult,
        };
      }
    } catch (error) {
      // TODO ASAP: figure out error handling here, especially for 3DS
      console.error('[flow][stripe-cc] Error checking out card info in CDE:', error);
      throw error;
    }
  }
);

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
    console.log('[flow][stripe-cc] Got validation errors in non-CDE form fields:', payload.data);
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
    if (!tokenizeResult.success) {
      // Validation errors can also come from CDE (from the sensitive fields)
      onTokenizeResultValidationError(tokenizeResult, onValidationError);
      console.log('[flow][stripe-cc] Error tokenizing card: got validation errors', tokenizeResult.errors);
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
      console.error('[flow][stripe-cc] Unknown field name in onValidationError:', error.elementType);
    } else {
      const fieldName = parsed.data;
      onValidationError(fieldName, error.errors);
    }
  });
  console.error('[flow][stripe-cc] Error tokenizing card:', errorResponse.errors);
};
