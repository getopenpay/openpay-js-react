import { z } from 'zod';
import { CdeConnection, CdeMessage } from './cde-connection';
import { CheckoutPreviewRequest } from './shared-models';
import { PreviewCheckoutResponse } from './cde_models';

const queryCDE = async <T extends z.ZodType>(
  cdeConn: CdeConnection,
  data: CdeMessage,
  responseSchema: T
): Promise<z.infer<T>> => {
  // Leaving these as commented out for easier debugging later
  // console.log('[cde-client] Querying CDE with path and connection:', data.type, cdeConn);
  const response = await cdeConn.send(data);
  // console.log('[cde-client] Got response from CDE:', response);
  if (!checkIfConformsToSchema(response, responseSchema)) {
    const result = responseSchema.safeParse(response);
    if (result.success) throw new Error('Invalid state');
    throw result.error;
  }
  return response;
};

const checkIfConformsToSchema = <T extends z.ZodType>(value: unknown, schema: T): value is T => {
  return schema.safeParse(value).success;
};

// Endpoints start here

export const getCheckoutPreview = async (
  cdeConn: CdeConnection,
  request: CheckoutPreviewRequest
): Promise<PreviewCheckoutResponse> => {
  return await queryCDE(cdeConn, { type: 'get_checkout_preview', payload: request }, PreviewCheckoutResponse);
};
