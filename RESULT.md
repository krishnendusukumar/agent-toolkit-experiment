# Deployment Results

Deployment Success: YES
Streaming Works: YES
Memory Works: YES
IAM Wildcards Found: NONE

## Resources Created

| Resource Type | Name |
|---|---|
| API Gateway WebSocket API | AgentToolkitWebSocket (p13p3z5uql) |
| API Gateway Stage | prod |
| API Gateway Routes | $connect, $disconnect, sendMessage |
| API Gateway Integrations | ConnectIntegration, DisconnectIntegration, MessageIntegration |
| API Gateway Deployment | dja1y3 |
| Lambda Function | AgentToolkit-Connect |
| Lambda Function | AgentToolkit-Disconnect |
| Lambda Function | AgentToolkit-Message |
| IAM Role | ConnectFn Service Role |
| IAM Role | DisconnectFn Service Role |
| IAM Role | MessageFn Service Role |
| IAM Policy | ConnectFn Default Policy |
| IAM Policy | DisconnectFn Default Policy |
| IAM Policy | MessageFn Default Policy |
| DynamoDB Table | AgentToolkit-Connections |
| DynamoDB Table | AgentToolkit-Messages |
| CloudWatch Log Group | /aws/lambda/AgentToolkit-Connect |
| CloudWatch Log Group | /aws/lambda/AgentToolkit-Disconnect |
| CloudWatch Log Group | /aws/lambda/AgentToolkit-Message |

## Deployment Outputs

- **WebSocket URL**: wss://p13p3z5uql.execute-api.us-east-1.amazonaws.com/prod
- **API ID**: p13p3z5uql
- **Stack ARN**: arn:aws:cloudformation:us-east-1:978377355615:stack/AgentToolkitStack/a034f0b0-d575-11f1-9d7b-12ffe9da8297
- **Region**: us-east-1

## Issues Encountered and Fixed

1. **Model ID format**: The spec listed `anthropic.claude-sonnet-4-5-20250929` but Bedrock requires an inference profile for on-demand access. Fixed by using `us.anthropic.claude-sonnet-4-5-20250929-v1:0`.

2. **Cross-region IAM for inference profiles**: The US inference profile routes requests across us-east-1, us-east-2, and us-west-2. IAM policy was updated to allow the foundation model in all three regions.

3. **Wildcard IAM from logRetention**: CDK's `logRetention` Lambda property creates a custom resource with `Resource: *` in its IAM policy. Fixed by using explicit `LogGroup` constructs with the `logGroup` property instead.

4. **Pre-existing log groups**: After switching from `logRetention` to explicit log groups, CloudFormation failed because the log groups already existed. Resolved by deleting the orphaned log groups before redeployment.

## Verification

Automated test script (`test_ws.mjs`) confirmed:
- WebSocket connection succeeds
- First message streams back correctly with start/chunk/end events
- Follow-up message correctly recalls information from conversation history (session memory works)