# Serverless AI Chat Application

A serverless chat application built on AWS that streams AI responses through WebSocket using Amazon Bedrock (Claude Sonnet 4.5) with conversation memory in DynamoDB.

## Architecture

```
Browser (WebSocket) → API Gateway (WebSocket) → Lambda → Bedrock (Claude Sonnet 4.5)
                                                    ↕
                                                 DynamoDB
                                              (conversations)
```

**Components:**
- **API Gateway WebSocket API** — handles `$connect`, `$disconnect`, and `sendMessage` routes
- **3 Lambda functions** — connection management and message processing with streaming
- **2 DynamoDB tables** — connections tracking and conversation history (session memory)
- **Amazon Bedrock** — Claude Sonnet 4.5 via US cross-region inference profile for streaming AI responses
- **IAM** — least-privilege roles scoped to specific actions and resource ARNs

## Project Structure

```
runs/B1/
├── infra/           # CDK infrastructure code
│   ├── bin/         # CDK app entry point
│   ├── lib/         # Stack definition
│   └── cdk.json     # CDK config
├── lambda/          # Lambda function handlers
│   ├── connect.js   # $connect handler
│   ├── disconnect.js # $disconnect handler
│   └── sendMessage.js # Message handler (Bedrock streaming)
├── frontend/        # Chat UI
│   └── index.html   # Single-page chat application
├── RESULT.md        # Deployment results and test output
├── TOOLKIT_USAGE.md # AWS toolkit usage log
└── README.md        # This file
```

## Deployment

### Prerequisites
- AWS CLI configured with credentials
- Node.js 20+
- AWS CDK CLI (`npm install -g aws-cdk`)
- CDK bootstrapped in your account/region

### Deploy
```bash
cd infra
npm install
CDK_DEFAULT_ACCOUNT=<your-account-id> CDK_DEFAULT_REGION=us-east-1 npx cdk deploy
```

### Outputs
After deployment, CDK outputs:
- `WebSocketUrl` — the WebSocket endpoint URL
- `ConnectionsTableName` — DynamoDB connections table
- `ConversationsTableName` — DynamoDB conversations table

## Usage

### Frontend
1. Open `frontend/index.html` in a browser
2. Paste the WebSocket URL from deployment outputs
3. Click **Connect**
4. Type a message and press Enter or click **Send**

Responses stream in real-time. Conversation history persists within the same session ID.

### WebSocket Protocol
Connect to the WebSocket URL, then send JSON messages:

```json
{
  "action": "sendMessage",
  "message": "Hello, what is 2+2?",
  "sessionId": "my-session-123"
}
```

Response events (streamed):
- `{"type": "chunk", "content": "...", "sessionId": "..."}` — text chunk
- `{"type": "end", "sessionId": "..."}` — stream complete
- `{"type": "usage", "usage": {"inputTokens": N, "outputTokens": N}, "sessionId": "..."}` — token usage
- `{"type": "error", "message": "...", "sessionId": "..."}` — error

### Testing with wscat
```bash
wscat -c wss://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
> {"action":"sendMessage","message":"Hello!","sessionId":"test-1"}
```

## Cleanup
```bash
cd infra
npx cdk destroy AiChatStack
```
