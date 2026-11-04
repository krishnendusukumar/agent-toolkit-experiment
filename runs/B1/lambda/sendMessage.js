const {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3,
  retryMode: "adaptive",
});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const MODEL_ID = process.env.MODEL_ID || "anthropic.claude-sonnet-4-5-20250929-v1:0";
const MAX_HISTORY = 20;

async function postToConnection(apigw, connectionId, data) {
  await apigw.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data)),
    })
  );
}

async function getConversationHistory(sessionId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: { sessionId },
    })
  );
  return result.Item?.messages || [];
}

async function saveConversationHistory(sessionId, messages) {
  await ddb.send(
    new PutCommand({
      TableName: CONVERSATIONS_TABLE,
      Item: {
        sessionId,
        messages,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

exports.handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const { domainName, stage } = event.requestContext;
  const callbackUrl = `https://${domainName}/${stage}`;

  const apigw = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    await postToConnection(apigw, connectionId, {
      type: "error",
      message: "Invalid JSON",
    });
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { message, sessionId } = body;
  if (!message || !sessionId) {
    await postToConnection(apigw, connectionId, {
      type: "error",
      message: "Missing message or sessionId",
    });
    return { statusCode: 400, body: "Missing fields" };
  }

  try {
    const history = await getConversationHistory(sessionId);

    const newMessage = { role: "user", content: [{ text: message }] };
    const messages = [...history, newMessage].slice(-MAX_HISTORY);

    const response = await bedrock.send(
      new ConverseStreamCommand({
        modelId: MODEL_ID,
        messages,
        system: [{ text: "You are a helpful AI assistant. Be concise and clear." }],
        inferenceConfig: {
          maxTokens: 1024,
          temperature: 0.7,
        },
      })
    );

    let assistantText = "";

    if (response.stream) {
      for await (const event of response.stream) {
        if (event.contentBlockDelta?.delta?.text) {
          const chunk = event.contentBlockDelta.delta.text;
          assistantText += chunk;
          await postToConnection(apigw, connectionId, {
            type: "chunk",
            content: chunk,
            sessionId,
          });
        }
        if (event.messageStop) {
          await postToConnection(apigw, connectionId, {
            type: "end",
            sessionId,
          });
        }
        if (event.metadata?.usage) {
          await postToConnection(apigw, connectionId, {
            type: "usage",
            usage: event.metadata.usage,
            sessionId,
          });
        }
      }
    }

    const assistantMessage = {
      role: "assistant",
      content: [{ text: assistantText }],
    };
    await saveConversationHistory(sessionId, [
      ...messages,
      assistantMessage,
    ].slice(-MAX_HISTORY));

    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Error:", err);
    try {
      await postToConnection(apigw, connectionId, {
        type: "error",
        message: err.message || "Internal error",
        sessionId,
      });
    } catch (postErr) {
      console.error("Failed to send error to client:", postErr);
    }
    return { statusCode: 500, body: "Error" };
  }
};
