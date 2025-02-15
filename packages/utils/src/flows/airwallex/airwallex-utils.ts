import { z } from 'zod';
import { start3dsVerificationStrict } from '../../3ds-elements/events';
import { getErrorMessage } from '../../errors';
import { createOjsFlowLoggers } from '../ojs-flow';
import { InitAirwallexGooglePayFlowResult } from './types/google-pay.types';
import { InitAirwallexApplePayFlowResult } from './types/apple-pay.types';

const { log__, err__ } = createOjsFlowLoggers('airwallex-cc');

// Based on CDE error response headers
const Airwallex3dsErrorResponseHeaders = z.object({
  'op-airwallex-3ds-url': z.string(),
  'op-airwallex-initial-intent-id': z.string(),
  'op-airwallex-consent-id': z.string(),
});
type Airwallex3dsErrorResponseHeaders = z.infer<typeof Airwallex3dsErrorResponseHeaders>;

const parseResponseHeaders = (errorResponseHeaders?: Record<string, string>): Airwallex3dsErrorResponseHeaders => {
  const parseResult = Airwallex3dsErrorResponseHeaders.safeParse(errorResponseHeaders);
  if (!parseResult.success) {
    const friendlyErr = 'Unable to process your credit card. Please contact support for assistance.';
    const devErr = `Airwallex 3DS is required but headers are malformed. Got: ${JSON.stringify(errorResponseHeaders)}`;
    err__(devErr);
    throw new Error(friendlyErr);
  }
  return parseResult.data;
};

export const checkIfRequiresAirwallex3ds = (errorResponseHeaders?: Record<string, string>) => {
  return errorResponseHeaders?.['op-airwallex-3ds-url'] !== undefined;
};

export const parseIntentIdFrom3dsHref = (href: string): string => {
  try {
    const intentId = new URL(href ?? '').searchParams.get('payment_intent_id');
    if (!intentId) {
      throw new Error('No intent ID found in Airwallex 3DS verification result');
    }
    log__(`Airwallex 3DS verification success. [Intent ID: ${intentId}]`);
    return intentId;
  } catch (error) {
    const errMsg = `Error verifying Airwallex 3DS verification result.`;
    err__(errMsg, `Resulting URL: ${href}.\nError: ${getErrorMessage(error)}`);
    throw new Error(errMsg);
  }
};

export const runAirwallex3dsFlow = async (baseUrl: string, errorResponseHeaders?: Record<string, string>) => {
  const headers = parseResponseHeaders(errorResponseHeaders);
  const result = await start3dsVerificationStrict({ url: headers['op-airwallex-3ds-url'], baseUrl });
  const intentId = parseIntentIdFrom3dsHref(result.href ?? '');
  const initialIntentId = headers['op-airwallex-initial-intent-id'];

  if (initialIntentId !== intentId) {
    const friendlyErr = 'Unable to process your credit card. Please contact support for assistance.';
    const devErr = `Intent ID from callback (${intentId}) does not match the initial intent ID (${initialIntentId}).`;
    err__(devErr);
    throw new Error(friendlyErr);
  }

  const extraMetadataForCheckout = {
    existing_cc: {
      initial_intent_id: intentId,
      consent_id: headers['op-airwallex-consent-id'],
    },
  };

  return extraMetadataForCheckout;
};

export const AWX_LOADING: InitAirwallexGooglePayFlowResult | InitAirwallexApplePayFlowResult = {
  isAvailable: false,
  isLoading: true,
  startFlow: async () => {},
};
