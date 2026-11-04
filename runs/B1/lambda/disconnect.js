const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.CONNECTIONS_TABLE;

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { connectionId },
    })
  );
  return { statusCode: 200, body: "Disconnected" };
};
