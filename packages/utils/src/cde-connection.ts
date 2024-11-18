import { connectToChild } from 'penpal';

export type CdeMessage = {
  type: string;
} & Record<string, unknown>;

export type CdeConnection = {
  send: (data: CdeMessage) => Promise<unknown>;
};

export const checkIfValidCdeConnectionObject = async (obj: unknown): Promise<boolean> => {
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
export const isResultValid = (obj: unknown, isValid: boolean): obj is CdeConnection => {
  return !!obj && isValid;
};

export async function createCdeConnection(iframe: HTMLIFrameElement): Promise<CdeConnection> {
  const connection = connectToChild({
    iframe,
    debug: true,
  });
  const connectionObj = await connection.promise;
  const isValidObject = await checkIfValidCdeConnectionObject(connectionObj);
  if (!isResultValid(connectionObj, isValidObject)) {
    throw new Error(`Got invalid CDE connection object`);
  }
  return connectionObj;
}
