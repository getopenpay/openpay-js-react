import { CdeConnection, checkIfValidCdeConnectionObject, ElementType, isResultValid } from '@getopenpay/utils';
import { connectToChild } from 'penpal';

export async function createConnection(iframe: HTMLIFrameElement): Promise<CdeConnection> {
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
