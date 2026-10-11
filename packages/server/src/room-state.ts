import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Entity, PutItemCommand, ScanCommand, Table, any, item, string } from 'dynamodb-toolbox';

/**
 * Platform table `room-state`: one item per state event type (PK `type`),
 * holding the latest envelope. The snapshot is a scan of it.
 */
export interface StateStore {
  put(envelope: { type: string; id: string }): Promise<void>;
  list(): Promise<unknown[]>;
}

export function createRoomStateTable(name: string, documentClient?: DynamoDBDocumentClient) {
  const client =
    documentClient ??
    DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  const table = new Table({
    name,
    partitionKey: { name: 'type', type: 'string' },
    documentClient: client,
  });
  const entity = new Entity({
    name: 'RoomState',
    table,
    timestamps: false,
    schema: item({
      type: string().key(),
      envelope: any(),
    }),
  });
  return { table, entity };
}

export function createStateStore(
  name: string,
  documentClient?: DynamoDBDocumentClient,
): StateStore {
  const { table, entity } = createRoomStateTable(name, documentClient);
  return {
    async put(envelope) {
      await entity.build(PutItemCommand).item({ type: envelope.type, envelope }).send();
    },
    async list() {
      const items: unknown[] = [];
      let exclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const page = await table
          .build(ScanCommand)
          .entities(entity)
          .options({ exclusiveStartKey })
          .send();
        for (const row of page.Items ?? []) items.push(row.envelope);
        exclusiveStartKey = page.LastEvaluatedKey;
      } while (exclusiveStartKey);
      return items;
    },
  };
}

/** In-memory store for tests and local runs without DynamoDB. */
export function createMemoryStateStore(): StateStore & { items: Map<string, unknown> } {
  const items = new Map<string, unknown>();
  return {
    items,
    put: (envelope) => {
      items.set(envelope.type, envelope);
      return Promise.resolve();
    },
    list: () => Promise.resolve([...items.values()]),
  };
}
