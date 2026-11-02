import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.CONNECTIONS_TABLE;

export async function handler(event) {
  const connectionId = event.requestContext.connectionId;
  const sessionId = event.queryStringParameters?.sessionId || connectionId;

  await ddb.send(new PutItemCommand({
    TableName: TABLE,
    Item: {
      connectionId: { S: connectionId },
      sessionId: { S: sessionId },
      connectedAt: { N: String(Date.now()) },
    },
  }));

  return { statusCode: 200, body: 'Connected' };
}