import { CdeError, checkoutCardElements, getPrefill, setupCheckout, tokenizeCard } from '../../cde-client';
import {
  AllFieldNames,
  FieldName,
  RequiredFormFields,
  TokenizeCardErrorResponse,
  TokenizeCardResponse,
} from '../../shared-models';
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
//   console.log('[flow] Overriding empty zip code (only for google pay, apple pay, and stripe link)');
//   extraData[FieldName.ZIP_CODE] = '00000';
// }

const { log, err } = createOjsFlowLoggers('stripe-cc');

/*
 * Runs the main Stripe CC flow
 */
export const runStripeCcFlow: RunOjsFlow = addBasicCheckoutCallbackHandlers(
  async ({ context, checkoutPaymentMethod, nonCdeFormInputs, flowCallbacks }): Promise<SimpleOjsFlowResult> => {
    const anyCdeConnection = Array.from(context.cdeConnections.values())[0];
    const prefill = await getPrefill(anyCdeConnection);

    log('Validating non-CDE form fields');
    const nonCdeFormFields = validateNonCdeFormFields(nonCdeFormInputs, flowCallbacks.onValidationError);

    log('Tokenizing card info in CDE');
    const tokenizeCardResults = await tokenizeCard(context.cdeConnections, {
      session_id: context.elementsSessionId,
    });
    validateTokenizeCardResults(tokenizeCardResults, flowCallbacks.onValidationError);

    try {
      // TODO ASAP: check if logs are actually logging
      if (prefill.mode === 'setup') {
        log('Setting up payment method in CDE');
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
        log('Checking out card info in CDE');
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
      err('Error checking out card info in CDE:', error);
      if (error instanceof CdeError) {
        err('Got CDE error', error.originalErrorMessage);
        if (error.originalErrorMessage === '3DS_REQUIRED') {
          // TODO ASAP: do 3DS stuff here
          // TODO ASAP: check out the 3DS flow in event.ts (3DS_REQUIRED)
        }
      }
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
    if (tokenizeResult.success === false) {
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
