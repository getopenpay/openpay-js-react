import { CdeConnection, checkIfValidCdeConnectionObject, isResultValid } from '@getopenpay/utils';
import { connectToChild } from 'penpal';

export async function createConnection(iframe: HTMLIFrameElement, childOrigin?: string): Promise<CdeConnection> {
  const connection = connectToChild({
    iframe,
    debug: true,
    // TODO: find a solution for this
    timeout: 1000,
    childOrigin,
  });
  const connectionObj = await connection.promise;
  const isValidObject = await checkIfValidCdeConnectionObject(connectionObj);
  if (!isResultValid(connectionObj, isValidObject)) {
    throw new Error(`Got invalid CDE connection object`);
  }
  return connectionObj;
}

export class ConnectionManager {
  private connections: Map<string, CdeConnection>;

  constructor() {
    this.connections = new Map<string, CdeConnection>();
  }

  public addConnection(id: string, connection: CdeConnection): void {
    this.connections.set(id, connection);
  }

  public getConnection(): CdeConnection {
    const connection = this.connections.values().next().value;
    if (!connection) {
      throw new Error('Connection not found');
    }
    return connection;
  }
}
