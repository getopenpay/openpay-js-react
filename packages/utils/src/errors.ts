import { z } from 'zod';

// PydanticValidationError
export const PydanticValidationError = z.object({
  type: z.string(),
  loc: z.array(z.string()),
  msg: z.string(),
  url: z.string(),
});
export type PydanticValidationError = z.infer<typeof PydanticValidationError>;

// PydanticValidationErrorResponse
export const PydanticValidationErrorResponse = z.array(PydanticValidationError);
export type PydanticValidationErrorResponse = z.infer<typeof PydanticValidationErrorResponse>;

// Zod Validation Error
export const ZodFieldError = z.object({
  code: z.string(),
  message: z.string(),
  path: z.array(z.string()),
});
export type ZodFieldError = z.infer<typeof ZodFieldError>;

export const ZodFieldErrors = z.array(ZodFieldError);
export type ZodFieldErrors = z.infer<typeof ZodFieldErrors>;

const MAP_TO_HUMAN_FRIENDLY_LOWERCASE: { [key: string]: string } = {
  'failed to fetch': `Connection error: please double check if you are connected to the internet, then try again`,
};

const getHumanFriendlyMessage = (ogErrorMessage: string): string => {
  const key = ogErrorMessage.toLowerCase().trim();
  return MAP_TO_HUMAN_FRIENDLY_LOWERCASE[key] ?? ogErrorMessage;
};

const isStringifiedJsonObject = (str: string): boolean => {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object';
  } catch (e) {
    return false;
  }
};

const createMessageFromPydanticValidationError = (response: PydanticValidationErrorResponse): string => {
  if (response.length === 1) {
    return getHumanFriendlyMessage(response[0].msg);
  } else {
    const bulleted = response.map((err) => `• ${getHumanFriendlyMessage(err.msg)}`).join('\n');
    return `${`Please fix the following errors:`}\n${bulleted}`;
  }
};

const createMessageFromZodFieldErrors = (errors: ZodFieldErrors): string => {
  const listOfErrors = errors.map((err) => `- ${err.path.join('/')}: ${err.message}`).join('\n');
  return `Encountered the following errors:\n${listOfErrors}`;
};

export const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) {
    if (isStringifiedJsonObject(e.message)) {
      const obj = JSON.parse(e.message);
      // Convert to list of objects and parsers once we have more
      if (PydanticValidationErrorResponse.safeParse(obj).success) {
        return createMessageFromPydanticValidationError(obj);
      } else if (ZodFieldErrors.safeParse(obj).success) {
        return createMessageFromZodFieldErrors(obj);
      } else {
        console.warn(`Encountered unknown stringified JSON object:\n${e.message}`);
        return e.message;
      }
    } else {
      // Plain string
      return getHumanFriendlyMessage(e.message);
    }
  }
  if (typeof e === 'object') {
    try {
      return JSON.stringify(e);
    } catch (e2: unknown) {
      return e2 + '';
    }
  } else {
    return e + '';
  }
};

/**
 * Wraps a callback in a try-catch to prevent the form from crashing if the callback throws an error.
 * @param callbackName - The name of the callback (for logging purposes)
 * @param fn - The callback function to wrap
 * @returns The wrapped callback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeCallbackSafe = <T extends (...args: any[]) => any>(callbackName: string, fn: T): T => {
  return ((...args: Parameters<T>): ReturnType<T> | undefined => {
    try {
      return fn(...args);
    } catch (error) {
      console.error(`[form] Error running callback (${callbackName}):`, error);
      return undefined;
    }
  }) as T;
};
