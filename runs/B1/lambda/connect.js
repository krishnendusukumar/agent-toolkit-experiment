const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.CONNECTIONS_TABLE;

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { connectionId, connectedAt: new Date().toISOString() },
    })
  );
  return { statusCode: 200, body: "Connected" };
};
