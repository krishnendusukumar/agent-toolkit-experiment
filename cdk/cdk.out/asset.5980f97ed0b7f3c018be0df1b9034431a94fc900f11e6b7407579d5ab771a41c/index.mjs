import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

const ddb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION_NAME || 'us-east-1' });

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const MODEL_ID = process.env.BEDROCK_MODEL_ID;

export async function handler(event) {
  const connectionId = event.requestContext.connectionId;
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  const apigw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domain}/${stage}`,
  });

  try {
    const body = JSON.parse(event.body);
    const userMessage = body.message;

    if (!userMessage) {
      await postToConnection(apigw, connectionId, { type: 'error', message: 'No message provided' });
      return { statusCode: 400, body: 'No message' };
    }

    const connResult = await ddb.send(new GetItemCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId: { S: connectionId } },
    }));

    const sessionId = connResult.Item?.sessionId?.S || connectionId;

    const history = await getConversationHistory(sessionId);

    const now = Date.now();
    await ddb.send(new PutItemCommand({
      TableName: MESSAGES_TABLE,
      Item: {
        sessionId: { S: sessionId },
        timestamp: { N: String(now) },
        role: { S: 'user' },
        content: { S: userMessage },
      },
    }));

    const messages = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    const bedrockBody = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      system: 'You are a helpful AI assistant. Be concise and helpful.',
    });

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: bedrockBody,
    });

    const response = await bedrock.send(command);

    let fullResponse = '';

    await postToConnection(apigw, connectionId, { type: 'start' });

    for await (const event of response.body) {
      if (event.chunk) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          fullResponse += chunk.delta.text;
          await postToConnection(apigw, connectionId, {
            type: 'chunk',
            text: chunk.delta.text,
          });
        }
      }
    }

    await postToConnection(apigw, connectionId, { type: 'end' });

    await ddb.send(new PutItemCommand({
      TableName: MESSAGES_TABLE,
      Item: {
        sessionId: { S: sessionId },
        timestamp: { N: String(now + 1) },
        role: { S: 'assistant' },
        content: { S: fullResponse },
      },
    }));

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Error:', err);
    try {
      await postToConnection(apigw, connectionId, {
        type: 'error',
        message: err.message || 'Internal error',
      });
    } catch (postErr) {
      console.error('Failed to send error to client:', postErr);
    }
    return { statusCode: 500, body: 'Error' };
  }
}

async function getConversationHistory(sessionId) {
  const result = await ddb.send(new QueryCommand({
    TableName: MESSAGES_TABLE,
    KeyConditionExpression: 'sessionId = :sid',
    ExpressionAttributeValues: { ':sid': { S: sessionId } },
    ScanIndexForward: true,
    Limit: 50,
  }));

  return (result.Items || []).map(item => ({
    role: item.role.S,
    content: item.content.S,
  }));
}

async function postToConnection(apigw, connectionId, data) {
  await apigw.send(new PostToConnectionCommand({
    ConnectionId: connectionId,
    Data: JSON.stringify(data),
  }));
}