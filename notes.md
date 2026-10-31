# Experiment Notes

## 1. Bedrock Model Used

- **Spec requested**: `anthropic.claude-sonnet-4-5-20250929`
- **Actual model deployed**: `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (US cross-region inference profile)
- The foundation model ID `anthropic.claude-sonnet-4-5-20250929-v1:0` cannot be invoked directly with on-demand throughput; an inference profile is required.

## 2. AWS Services Created

| Service | Resource |
|---|---|
| Amazon API Gateway v2 | WebSocket API (`AgentToolkitWebSocket`) |
| AWS Lambda | 3 functions (Connect, Disconnect, Message) |
| Amazon DynamoDB | 2 tables (Connections, Messages) |
| Amazon Bedrock | Claude Sonnet 4.5 via inference profile |
| Amazon CloudWatch Logs | 3 log groups |
| AWS IAM | 3 roles + 3 policies |
| AWS CloudFormation | 1 stack (`AgentToolkitStack`) |

## 3. Lambda Runtime

- **Runtime**: `nodejs20.x` (Node.js 20.x)
- **Handler format**: ESM (`.mjs` files)
- **SDK**: AWS SDK v3 (bundled in Lambda runtime)
- **Timeouts**: Connect/Disconnect = 10s, Message = 120s
- **Memory**: Connect/Disconnect = 128MB, Message = 512MB

## 4. Bedrock API Used

- **API**: `InvokeModelWithResponseStream`
- **SDK Client**: `BedrockRuntimeClient` from `@aws-sdk/client-bedrock-runtime`
- **SDK Command**: `InvokeModelWithResponseStreamCommand`
- **Request format**: Anthropic Messages API via `anthropic_version: 'bedrock-2023-05-31'`
- **NOT used**: Converse, ConverseStream, InvokeModel (non-streaming)

## 5. All IAM Permissions Created

### ConnectFn Service Role Policy
- **Actions**: `dynamodb:BatchGetItem`, `dynamodb:Query`, `dynamodb:GetItem`, `dynamodb:Scan`, `dynamodb:ConditionCheckItem`, `dynamodb:BatchWriteItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, `dynamodb:DescribeTable`, `dynamodb:GetRecords`, `dynamodb:GetShardIterator`
- **Resource**: AgentToolkit-Connections table ARN

### DisconnectFn Service Role Policy
- **Actions**: Same DynamoDB actions as ConnectFn
- **Resource**: AgentToolkit-Connections table ARN

### MessageFn Service Role Policy
- **Actions on Connections table**: Same DynamoDB actions
- **Actions on Messages table**: Same DynamoDB actions
- **Actions on Bedrock**: `bedrock:InvokeModelWithResponseStream`
  - Resources: Foundation model in us-east-1, us-east-2, us-west-2 + inference profile ARN
- **Actions on API Gateway**: `execute-api:ManageConnections`
  - Resource: `arn:aws:execute-api:us-east-1:978377355615:<api-id>/prod/POST/@connections/*`

### Lambda Invoke Permissions (resource-based)
- API Gateway is granted `lambda:InvokeFunction` on each Lambda, scoped to specific route ARNs

## 6. Wildcard IAM Permissions Count

**Total wildcards: 0**

No `Action: "*"` or `Resource: "*"` patterns found in any IAM policy. The `@connections/*` wildcard in the execute-api resource is required by the API Gateway Management API pattern (it refers to dynamically-created connection IDs, not a blanket permission).

## 7. Deployment Status

- **Status**: SUCCESS
- **Stack**: `AgentToolkitStack`
- **Region**: us-east-1
- **Account**: 978377355615
- **Deployment time**: ~120s total (synth + deploy)

## 8. Resources Created

27 CloudFormation resources total:

- 1 API Gateway WebSocket API
- 1 API Gateway Stage (prod)
- 1 API Gateway Deployment
- 3 API Gateway Routes ($connect, $disconnect, sendMessage)
- 3 API Gateway Integrations (AWS_PROXY to Lambda)
- 3 Lambda Functions
- 3 Lambda Permissions (resource-based policies)
- 3 IAM Roles (Lambda execution roles)
- 3 IAM Policies (inline policies for DynamoDB/Bedrock/API GW)
- 3 CloudWatch Log Groups
- 2 DynamoDB Tables
- 1 CDK Metadata

## 9. Errors Encountered

1. **`aws` CLI exit code 120**: The AWS CLI installed via snap returned exit code 120 for all commands. Workaround: used boto3 in a Python venv for AWS API calls; CDK worked independently.

2. **Invalid model ID**: `anthropic.claude-sonnet-4-5-20250929` returned "The provided model identifier is invalid." Fix: appended `-v1:0` suffix.

3. **On-demand throughput not supported**: Direct foundation model invocation with `anthropic.claude-sonnet-4-5-20250929-v1:0` failed. Fix: switched to US inference profile `us.anthropic.claude-sonnet-4-5-20250929-v1:0`.

4. **Cross-region IAM denial**: The US inference profile routes to us-east-2, but IAM only allowed us-east-1. Fix: added foundation model ARNs for us-east-1, us-east-2, and us-west-2.

5. **logRetention wildcard IAM**: CDK's `logRetention` property creates a custom resource Lambda with `Resource: *`. Fix: replaced with explicit `LogGroup` constructs.

6. **Pre-existing log groups**: After switching from `logRetention` to explicit log groups, CloudFormation rejected the deploy because the log groups already existed. Fix: deleted orphaned log groups before redeployment.

## 10. Suggested Experiment Observations

1. **Bedrock model access requires inference profiles**: Direct foundation model IDs no longer work for on-demand invocation in Bedrock. Any automation must discover and use inference profiles.

2. **Cross-region IAM is non-obvious**: US inference profiles silently route requests to other regions. IAM policies scoped to a single region will fail intermittently depending on routing. This is a common gotcha for production deployments.

3. **CDK's logRetention introduces wildcard IAM**: The convenient `logRetention` property on Lambda creates a custom resource with `Resource: *`. For least-privilege compliance, explicit `LogGroup` constructs are required.

4. **WebSocket + Bedrock streaming works well**: The pattern of Lambda receiving a WebSocket message, streaming from Bedrock, and posting chunks back via the API Gateway Management API provides real-time streaming with no additional infrastructure.

5. **DynamoDB conversation history is simple but effective**: Using a sessionId partition key with timestamp sort key provides ordered conversation history with a single Query operation. The 50-message limit prevents context window overflow.

6. **No authentication**: The WebSocket API has `authorizationType: NONE`. For production, consider Cognito or Lambda authorizers.

7. **Lambda cold starts**: The Message Lambda (512MB) may experience cold starts of 1-2 seconds. This is additive to Bedrock's first-token latency.

8. **Cost profile**: PAY_PER_REQUEST DynamoDB + on-demand Lambda + Bedrock per-token pricing means zero cost at rest, scaling linearly with usage.