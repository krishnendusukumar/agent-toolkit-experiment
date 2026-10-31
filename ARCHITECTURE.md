# Architecture

## Overview

```
┌─────────────┐      WebSocket       ┌──────────────────┐
│   React     │◄────────────────────►│  API Gateway v2   │
│   Frontend  │   wss://...          │  (WebSocket)      │
└─────────────┘                      └────────┬─────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                    $connect            $disconnect          sendMessage
                          │                   │                   │
                   ┌──────▼──────┐    ┌───────▼──────┐    ┌──────▼──────┐
                   │  Connect    │    │  Disconnect   │    │  Message    │
                   │  Lambda     │    │  Lambda       │    │  Lambda     │
                   └──────┬──────┘    └───────┬──────┘    └──┬────┬─────┘
                          │                   │              │    │
                          ▼                   ▼              ▼    ▼
                   ┌─────────────────────────────┐    ┌────────────────┐
                   │  DynamoDB: Connections       │    │  Amazon        │
                   │  (connectionId → sessionId)  │    │  Bedrock       │
                   └─────────────────────────────┘    │  (Claude)      │
                                                      └────────────────┘
                                                           │
                   ┌─────────────────────────────┐         │
                   │  DynamoDB: Messages          │◄────────┘
                   │  (sessionId + timestamp)     │
                   └─────────────────────────────┘
```

## Frontend

- **Framework**: React 18
- **Build tool**: react-scripts (Create React App)
- **Source**: `frontend/src/App.js`
- **Features**:
  - WebSocket URL configuration input
  - Session ID generation (random `sess-XXXXXXXX`)
  - Real-time streaming display with cursor indicator
  - Message history with role-based styling (user = blue, assistant = white, error = yellow)
  - New session button to reset conversation
- **State management**: React hooks (`useState`, `useRef`, `useCallback`)
- **WebSocket protocol**: Sends `{"action": "sendMessage", "message": "..."}`, receives `{type: "start|chunk|end|error", ...}`

## API Gateway Configuration

- **Type**: API Gateway v2 (WebSocket protocol)
- **Name**: `AgentToolkitWebSocket`
- **Route selection**: `$request.body.action`
- **Stage**: `prod`
- **Endpoint**: `wss://<api-id>.execute-api.us-east-1.amazonaws.com/prod`

### Routes

| Route Key | Integration | Lambda |
|---|---|---|
| `$connect` | AWS_PROXY | AgentToolkit-Connect |
| `$disconnect` | AWS_PROXY | AgentToolkit-Disconnect |
| `sendMessage` | AWS_PROXY | AgentToolkit-Message |

### Connection Flow

1. Client connects with `?sessionId=<id>` query parameter
2. `$connect` Lambda stores connection-to-session mapping
3. Client sends messages with `action: "sendMessage"`
4. `sendMessage` Lambda processes and streams response back
5. On disconnect, `$disconnect` Lambda cleans up connection record

## Lambda Functions

### AgentToolkit-Connect

- **Runtime**: Node.js 20.x (ESM)
- **Memory**: 128 MB
- **Timeout**: 10 seconds
- **Purpose**: Stores WebSocket connection ID and session ID in DynamoDB
- **Source**: `cdk/lambda/connect/index.mjs`

### AgentToolkit-Disconnect

- **Runtime**: Node.js 20.x (ESM)
- **Memory**: 128 MB
- **Timeout**: 10 seconds
- **Purpose**: Deletes connection record from DynamoDB
- **Source**: `cdk/lambda/disconnect/index.mjs`

### AgentToolkit-Message

- **Runtime**: Node.js 20.x (ESM)
- **Memory**: 512 MB
- **Timeout**: 120 seconds
- **Purpose**: Processes chat messages with Bedrock streaming and session memory
- **Source**: `cdk/lambda/message/index.mjs`
- **Flow**:
  1. Parse incoming WebSocket message
  2. Look up session ID from Connections table
  3. Query conversation history from Messages table (last 50 messages)
  4. Save user message to Messages table
  5. Call Bedrock `InvokeModelWithResponseStream`
  6. Stream each text chunk back to client via API Gateway Management API
  7. Save complete assistant response to Messages table

## DynamoDB Tables

### AgentToolkit-Connections

| Attribute | Type | Key |
|---|---|---|
| `connectionId` | String | Partition Key |
| `sessionId` | String | Attribute |
| `connectedAt` | Number | Attribute |

- **Billing**: PAY_PER_REQUEST
- **Purpose**: Maps WebSocket connection IDs to session IDs

### AgentToolkit-Messages

| Attribute | Type | Key |
|---|---|---|
| `sessionId` | String | Partition Key |
| `timestamp` | Number | Sort Key |
| `role` | String | Attribute (`user` or `assistant`) |
| `content` | String | Attribute (message text) |

- **Billing**: PAY_PER_REQUEST
- **Purpose**: Stores conversation history per session
- **Query pattern**: `sessionId = :sid` with `ScanIndexForward: true`, `Limit: 50`

## Bedrock Integration

- **Model**: Claude Sonnet 4.5 (`anthropic.claude-sonnet-4-5-20250929-v1:0`)
- **Inference profile**: `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (cross-region US)
- **API**: `InvokeModelWithResponseStream` (Anthropic Messages API format)
- **Max tokens**: 4096
- **System prompt**: "You are a helpful AI assistant. Be concise and helpful."
- **Streaming**: Async iterator over response body, extracting `content_block_delta` events

## Authentication Mechanism

**None.**

- The `$connect` route has `authorizationType: NONE`
- No Cognito, Lambda authorizer, or IAM auth is configured
- Any client that knows the WebSocket URL can connect and send messages
- Session isolation is by client-provided `sessionId` query parameter (not enforced server-side)

### Production Recommendations

For a production deployment, consider:
- AWS Cognito authorizer on the `$connect` route
- Server-generated session IDs (instead of client-provided)
- Rate limiting via API Gateway throttling settings
- WAF integration for the API Gateway endpoint
