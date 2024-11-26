import {
  CdeConnection,
  checkIfValidCdeConnectionObject,
  ElementType,
  isResultValid,
  CdeMessage,
  Ping3DSStatusResponse,
} from '@getopenpay/utils';
import { connectToChild } from 'penpal';

export async function createConnection(iframe: HTMLIFrameElement, childOrigin?: string): Promise<CdeConnection> {
  const connection = connectToChild({
    iframe,
    debug: true,
    childOrigin,
  });
  const connectionObj = await connection.promise;
  const isValidObject = await checkIfValidCdeConnectionObject(connectionObj);
  if (!isResultValid(connectionObj, isValidObject)) {
    throw new Error(`Got invalid CDE connection object`);
  }
  return connectionObj;
}

/**
 * @throws if the response is not valid or connection failed
 */
export async function pingCdeFor3dsStatus(iframe: HTMLIFrameElement, childOrigin: string) {
  const connection = connectToChild({
    iframe,
    debug: true,
    timeout: 1000,
    childOrigin,
  });
  const connectionObj = await connection.promise;
  const message: CdeMessage = { type: 'ping-3ds-status' };
  // @ts-expect-error `send` typing
  const result = await connectionObj.send(message);
  const parsed = Ping3DSStatusResponse.parse(result);
  return parsed.status;
}

export class ConnectionManager {
  private connections: Map<ElementType, CdeConnection>;

  constructor() {
    this.connections = new Map<ElementType, CdeConnection>();
  }

  public addConnection(id: ElementType, connection: CdeConnection): void {
    this.connections.set(id, connection);
  }

  public getConnection(): CdeConnection {
    const connection = this.connections.values().next().value;
    if (!connection) {
      throw new Error('Connection not found');
    }
    return connection;
  }

  public getAllConnections(): Map<ElementType, CdeConnection> {
    return this.connections;
  }
}
