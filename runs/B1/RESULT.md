# Deployment Result

**Deployment Success:** YES
**Streaming Works:** YES
**Memory Works:** YES

## IAM Wildcards Found

- **No wildcard actions** (`"Action": "*"`) found in any policy
- **One wildcard resource** on the CDK-generated Log Retention Lambda role — scoped to `logs:PutRetentionPolicy` and `logs:DeleteRetentionPolicy` only. This is an unavoidable CDK internal construct (manages log groups that don't exist at deploy time). All application IAM is least-privilege.

## Resources Created

| Resource Type | Logical ID | Physical ID |
|---|---|---|
| API Gateway WebSocket API | ChatWebSocketApi | eo0o7xfc07 |
| API Gateway Stage | ProdStage | prod |
| API Gateway Route | $connect | dn28sv2 |
| API Gateway Route | $disconnect | xzmrlnl |
| API Gateway Route | sendMessage | g3booc6 |
| DynamoDB Table | ConnectionsTable | AiChatStack-ConnectionsTable8000B8A1-12XCZULSIRU7W |
| DynamoDB Table | ConversationsTable | AiChatStack-ConversationsTableCD91EB96-4FC9D506A1RS |
| Lambda Function | ConnectFunction | AiChatStack-ConnectFunction52BFC429-dqG2CxsnT4JW |
| Lambda Function | DisconnectFunction | AiChatStack-DisconnectFunctionEFD34B26-bfPr1MB8FdT5 |
| Lambda Function | SendMessageFunction | AiChatStack-SendMessageFunctionA37DCB9D-hMpBW60QvYta |
| IAM Role | ConnectFunctionServiceRole | (auto-generated) |
| IAM Role | DisconnectFunctionServiceRole | (auto-generated) |
| IAM Role | SendMessageFunctionServiceRole | (auto-generated) |
| IAM Policy | ConnectFunctionServiceRoleDefaultPolicy | DynamoDB write (connections table) |
| IAM Policy | DisconnectFunctionServiceRoleDefaultPolicy | DynamoDB write (connections table) |
| IAM Policy | SendMessageFunctionServiceRoleDefaultPolicy | DynamoDB read/write, Bedrock invoke, API Gateway manage connections |

## Deployment Outputs

- **WebSocket URL:** `wss://eo0o7xfc07.execute-api.us-east-1.amazonaws.com/prod`
- **Connections Table:** `AiChatStack-ConnectionsTable8000B8A1-12XCZULSIRU7W`
- **Conversations Table:** `AiChatStack-ConversationsTableCD91EB96-4FC9D506A1RS`
- **Stack ARN:** `arn:aws:cloudformation:us-east-1:978377355615:stack/AiChatStack/edf0b391-d889-11f1-a8fc-0affcef4c609`

## Test Results

### Test 1: Streaming
```
CONNECTED
MESSAGE SENT, session: test-1793822838613
2+2 equals 4.
--- STREAM END ---
USAGE: {"inputTokens":35,"outputTokens":12,"totalTokens":47}
Streaming works: true
```

### Test 2: Memory Persistence
```
CONNECTED, session: test-1793822838613
FOLLOW-UP SENT
You asked me what 2+2 equals.
--- STREAM END ---
USAGE: {"inputTokens":64,"outputTokens":14,"totalTokens":78}
Memory works: true
```

## Issues Encountered and Fixed

1. **Node.js runtime deprecation** — CDK warned that `nodejs20.x` was deprecated. Fixed by switching to `nodejs22.x`.

2. **On-demand throughput not supported** — Model ID `anthropic.claude-sonnet-4-5-20250929-v1:0` cannot be invoked directly with on-demand throughput. Fixed by using the US cross-region inference profile `us.anthropic.claude-sonnet-4-5-20250929-v1:0`.

3. **Cross-region IAM permissions** — The US inference profile routes requests to multiple US regions (us-east-1, us-east-2, us-west-2). The initial IAM policy only allowed the foundation model in us-east-1. Fixed by adding all US region foundation model ARNs plus the inference profile ARN.
