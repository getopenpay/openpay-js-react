import { CallSender, Connection, connectToChild } from 'penpal';
import { useState } from 'react';
import useAsyncEffect from 'use-async-effect';

export type CdeMessage = {
  type: string;
} & Record<string, unknown>;

export type CdeConnection = {
  send: (data: CdeMessage) => Promise<unknown>;
};

type HookReturnType = {
  cdeConn: CdeConnection | null;
  connectToCdeIframe: (iframe: HTMLIFrameElement) => Promise<void>;
};

type ConnectionStatus =
  | {
      status: 'none';
    }
  | {
      status: 'connecting';
    }
  | {
      status: 'waiting';
      conn: Connection<CallSender>;
    }
  | {
      status: 'connected';
      conn: CdeConnection;
    };

export const useCDEConnection = (): HookReturnType => {
  const [childConn, setChildConn] = useState<ConnectionStatus>({ status: 'none' });

  const connectToCdeIframe = async (iframe: HTMLIFrameElement): Promise<void> => {
    if (childConn.status !== 'none') {
      console.warn('registerIframe called more than once');
      return;
    }
    console.log('Connecting to CDE iframe...', iframe);
    setChildConn({ status: 'connecting' });
    const conn = connectToChild({
      iframe,
      debug: true,
    });
    setChildConn({ status: 'waiting', conn });
  };

  // Wait for connection
  useAsyncEffect(async () => {
    if (childConn.status !== 'waiting') return;
    const child: unknown = await childConn.conn.promise;
    const isValidConnObject = await checkIfValidCdeConnectionObject(child);
    if (!isResultValid(child, isValidConnObject)) {
      throw new Error(`Got invalid CDE connection object`);
    }
    setChildConn({ status: 'connected', conn: child });
  }, [childConn.status]);

  return {
    cdeConn: childConn.status === 'connected' ? childConn.conn : null,
    connectToCdeIframe,
  };
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
