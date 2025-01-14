import { OnValidationError } from '../../form-callbacks';
import { AllFieldNames, FieldName, PRFormFields, RequiredFormFields, TokenizeCardResponse } from '../../shared-models';
import { extractIssuesPerField } from '../../zod-errors';
import { createOjsFlowLoggers } from '../ojs-flow';

const { log__, err__ } = createOjsFlowLoggers('common-cc');

/**
 * Validates the non-CDE (non-sensitive) form fields for credit card flows
 */
export const validateNonCdeFormFieldsForCC = (
  nonCdeFormInputs: Record<string, unknown>,
  onValidationError: OnValidationError,
  usePrFormFields?: boolean
): RequiredFormFields | PRFormFields => {
  const payload = usePrFormFields
    ? PRFormFields.safeParse(nonCdeFormInputs)
    : RequiredFormFields.safeParse(nonCdeFormInputs);
  if (!payload.success) {
    const formatted = payload.error.format();
    const issues = extractIssuesPerField(formatted);
    for (const [fieldName, errors] of Object.entries(issues)) {
      onValidationError(fieldName as FieldName, errors, fieldName);
    }
    err__(`Got validation errors in non-CDE form fields`, issues);
    throw new Error('Got validation errors in non-CDE form fields');
  }

  return payload.data;
};

/**
 * Validates the tokenizeCard CDE call result.
 * This mostly happens when the CDE fields (i.e. sensitive fields) have validation errors.
 */
export const validateTokenizeCardResults = (
  tokenizeResults: TokenizeCardResponse[],
  onValidationError: OnValidationError
): void => {
  for (const tokenizeResult of tokenizeResults) {
    if (tokenizeResult.success === false) {
      // Call onValidationError for each field that has a validation error
      tokenizeResult.errors.forEach((error) => {
        const parsed = AllFieldNames.safeParse(error.elementType);
        if (!parsed.success) {
          err__(`Unknown field name in onValidationError: ${error.elementType}. Error object:`, error);
        } else {
          const fieldName = parsed.data;
          onValidationError(fieldName, error.errors);
        }
      });
      log__(`Error tokenizing card: got validation errors: ${JSON.stringify(tokenizeResult.errors)}`);
      throw new Error('Got validation errors while tokenizing card');
    }
  }
};
