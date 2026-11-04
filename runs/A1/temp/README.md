# AWS Agent Toolkit - Serverless AI Chat

A serverless AI chat application built on AWS using WebSocket streaming, Amazon Bedrock (Claude), and DynamoDB for conversation memory.

## Architecture

```
React Frontend  <-->  API Gateway WebSocket  <-->  Lambda  <-->  Amazon Bedrock
                                                     |
                                                  DynamoDB
                                              (Sessions + Messages)
```

### Components

- **API Gateway WebSocket** - Real-time bidirectional communication
- **Lambda Functions** - Connect, Disconnect, and Message handlers
- **Amazon Bedrock** - Claude Sonnet 4.5 for AI responses (inference profile: `us.anthropic.claude-sonnet-4-5-20250929-v1:0`)
- **DynamoDB** - Two tables for connection tracking and conversation history
- **AWS CDK** - Infrastructure as Code deployment

## Project Structure

```
cdk/
  bin/app.ts              # CDK app entry point
  lib/stack.ts            # CDK stack definition
  lambda/
    connect/index.mjs     # WebSocket $connect handler
    disconnect/index.mjs  # WebSocket $disconnect handler
    message/index.mjs     # Message handler with Bedrock streaming
frontend/
  src/App.js              # React chat UI
```

## Prerequisites

- Node.js 20+
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- CDK bootstrapped in target account/region

## Deployment

```bash
cd cdk
npm install
npx cdk bootstrap   # First time only
npx cdk deploy
```

The deployment outputs the WebSocket URL.

## Usage

### React Frontend

```bash
cd frontend
npm install
REACT_APP_WS_URL=wss://<api-id>.execute-api.us-east-1.amazonaws.com/prod npm start
wss://p13p3z5uql.execute-api.us-east-1.amazonaws.com/prod
```

Open the browser, enter the WebSocket URL, and start chatting.

### WebSocket Protocol

Connect with a session ID:
```
wss://<api-id>.execute-api.us-east-1.amazonaws.com/prod?sessionId=my-session
```

Send a message:
```json
{"action": "sendMessage", "message": "Hello!"}
```

Response events:
- `{"type": "start"}` - Stream beginning
- `{"type": "chunk", "text": "..."}` - Streamed text chunk
- `{"type": "end"}` - Stream complete
- `{"type": "error", "message": "..."}` - Error occurred

## IAM Permissions

All IAM permissions follow least-privilege:
- Lambda roles have scoped DynamoDB read/write for their specific tables
- Bedrock access is limited to the specific model/inference profile
- API Gateway management is scoped to the specific API and stage
- No wildcard (`*`) IAM permissions

## Cleanup

```bash
cd cdk
npx cdk destroy
```