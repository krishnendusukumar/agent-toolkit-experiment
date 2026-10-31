import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE;

export async function handler(event) {
  const connectionId = event.requestContext.connectionId;

  await ddb.send(new DeleteItemCommand({
    TableName: TABLE,
    Key: { connectionId: { S: connectionId } },
  }));

  return { statusCode: 200, body: 'Disconnected' };
}