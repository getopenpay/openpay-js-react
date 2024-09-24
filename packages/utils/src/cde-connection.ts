import { CallSender, Connection, connectToChild } from 'penpal';

export type CdeMessage = {
  type: string;
} & Record<string, unknown>;

export type CdeConnection = {
  send: (data: CdeMessage) => Promise<unknown>;
};

export const connectToCdeIframe = async (iframe: HTMLIFrameElement): Promise<Connection<CallSender>> => {
  //   if (childConn.status !== 'none') {
  //     console.warn('registerIframe called more than once');
  //     return;
  //   }
  console.log('Connecting to CDE iframe...', iframe);
  const connection = connectToChild({
    iframe,
    debug: true,
  });
  const child: unknown = await connection.promise;
  const isValidConnObject = await checkIfValidCdeConnectionObject(child);
  if (!isResultValid(child, isValidConnObject)) {
    throw new Error(`Got invalid CDE connection object`);
  }
  return connection;
};

const checkIfValidCdeConnectionObject = async (obj: unknown): Promise<boolean> => {
  if (typeof obj !== 'object' || !obj) return false;
  try {
    const ping: CdeMessage = { type: 'ping' };
    // @ts-expect-error `send` typing
    const result = await obj.send(ping);
    if (result !== true) {
      throw new Error(`Expected 'true' after ping, got ${JSON.stringify(result)}`);
    }
    return true;
  } catch (e) {
    console.error(`Invalid CDE connection check:`, e);
    return false;
  }
};

// Work around as an async type guard
const isResultValid = (obj: unknown, isValid: boolean): obj is CdeConnection => {
  return !!obj && isValid;
};
