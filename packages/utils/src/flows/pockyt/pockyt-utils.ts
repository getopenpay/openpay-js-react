import { z } from 'zod';
import { start3dsVerificationStrict } from '../../3ds-elements/events';
import { getErrorMessage } from '../../errors';
import { createOjsFlowLoggers } from '../ojs-flow';

const { log__, err__ } = createOjsFlowLoggers('pockyt-cc');

// Based on CDE error response headers
const Pockyt3dsErrorResponseHeaders = z.object({
  'op-pockyt-3ds-url': z.string(),
  'op-pockyt-txn-no': z.string(),
  'op-pockyt-ref-no': z.string(),
});
type Pockyt3dsErrorResponseHeaders = z.infer<typeof Pockyt3dsErrorResponseHeaders>;

const parseResponseHeaders = (errorResponseHeaders?: Record<string, string>): Pockyt3dsErrorResponseHeaders => {
  const parseResult = Pockyt3dsErrorResponseHeaders.safeParse(errorResponseHeaders);
  if (!parseResult.success) {
    const friendlyErr = 'Unable to process your credit card. Please contact support for assistance.';
    const devErr = `Pockyt 3DS is required but headers are malformed. Got: ${JSON.stringify(errorResponseHeaders)}`;
    err__(devErr);
    throw new Error(friendlyErr);
  }
  return parseResult.data;
};

/**
 * Parses the vault ID from the final 3DS verification result URL.
 * Pockyt redirects 3DS success to {baseUrl}/app/3ds/success/?vaultId={vaultId}
 */
const parseVaultIdFrom3dsHref = (href: string): string => {
  try {
    // Dev note: the parameter 'vaultId' can also be found in CDE's Pockyt API request, under callbackUrl
    const vaultId = new URL(href ?? '').searchParams.get('vaultId'); // new URL() throws if href is not a valid URL
    if (!vaultId) {
      throw new Error('No vault ID found in 3DS verification result');
    }
    log__(`3DS verification success. [Vault ID: ${vaultId}]`);
    return vaultId;
  } catch (error) {
    const errMsg = `Error verifying 3DS verification result.`;
    err__(errMsg, `Resulting URL: ${href}.\nError: ${getErrorMessage(error)}`);
    throw new Error(errMsg);
  }
};

export const checkIfRequiresPockyt3ds = (errorResponseHeaders?: Record<string, string>) => {
  return errorResponseHeaders?.['op-pockyt-3ds-url'] !== undefined;
};

export const runPockyt3dsFlow = async (baseUrl: string, errorResponseHeaders?: Record<string, string>) => {
  const headers = parseResponseHeaders(errorResponseHeaders);
  const result = await start3dsVerificationStrict({ url: headers['op-pockyt-3ds-url'], baseUrl });
  const vaultId = parseVaultIdFrom3dsHref(result.href ?? '');
  const extraMetadataForCheckout = {
    existing_cc: {
      vault_id: vaultId,
      transaction_no: headers['op-pockyt-txn-no'],
      reference_no: headers['op-pockyt-ref-no'],
    },
  };
  return extraMetadataForCheckout;
};
