import { z } from 'zod';
import { CdeConnection, CdeMessage } from './cde-connection';
// import postRobot from 'post-robot';

// const queryCDE = async <T extends z.ZodType>(
//   target: MessageEventSource,
//   path: string,
//   data: object,
//   responseSchema: T
//   // timeoutSec: number = 5_000
// ): Promise<z.infer<T>> => {
//   console.log('QueryCDE path and target', path, target);
//   for (let i = 3; i >= 0; i--) {
//     try {
//       console.log(`Trial ${i}`);
//       // @ts-expect-error target typing
//       const response = await postRobot.send('ojs-card-number-element', path, data, { timeout: 10_000 });
//       console.log('Got response');
//       if (!checkIfConformsToSchema(response.data, responseSchema)) {
//         const result = responseSchema.safeParse(response);
//         if (result.success) throw new Error('Invalid state');
//         throw result.error;
//       }
//       return response;
//     } catch (e) {
//       console.log(`Failed ${i}`);
//       if (i === 0) {
//         throw e;
//       }
//     }
//   }
// };

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

export const CheckoutPreviewResponse = z.object({});
export type CheckoutPreviewResponse = z.infer<typeof CheckoutPreviewResponse>;

export const getCheckoutPreview = async (cdeConn: CdeConnection): Promise<CheckoutPreviewResponse> => {
  // TODO ASAP: change params
  return await queryCDE(cdeConn, { type: 'get_checkout' }, CheckoutPreviewResponse);
};
