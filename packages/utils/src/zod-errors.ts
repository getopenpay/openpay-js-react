import { FieldName, FieldNameEnum } from './shared-models';

interface FormattedError {
  [key: string]: { _errors: string[] } | string[];
}

export const extractIssuesPerField = (error: FormattedError): Record<FieldName, string[]> => {
  const issuesPerField = {} as Record<FieldName, string[]>;

  Object.entries(error).forEach(([key, value]) => {
    try {
      const fieldName = FieldNameEnum.parse(key);

      if (Array.isArray(value)) {
        issuesPerField[fieldName] = value;
      } else if (Array.isArray(value._errors)) {
        issuesPerField[fieldName] = value._errors;
      }
    } catch {
      return;
    }
  });

  return issuesPerField;
};
