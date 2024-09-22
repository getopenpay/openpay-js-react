import { z } from 'zod';
import { CdeConnection, CdeMessage } from './cde-connection';
import { CheckoutPreviewRequest } from './shared-models';
import { PreviewCheckoutResponse } from './cde_models';

const queryCDE = async <T extends z.ZodType>(
  cdeConn: CdeConnection,
  // path: string,
  data: CdeMessage,
  responseSchema: T
  // timeoutSec: number = 5_000
): Promise<z.infer<T>> => {
  console.log('Query CDE path and connection', data.type, cdeConn);
  //// @ts-expect-error target typing
  // const response = await postRobot.send('ojs-card-number-element', path, data, { timeout: 10_000 });
  // console.log('Got response');
  const response = await cdeConn.send(data);
  console.log('Got response from CDE', response);
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
