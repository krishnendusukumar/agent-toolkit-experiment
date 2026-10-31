# Security Audit: IAM Permissions

## IAM Policies Created

### 1. ConnectFn Service Role Default Policy

**Attached to**: AgentToolkit-Connect Lambda execution role

| Effect | Actions | Resource |
|---|---|---|
| Allow | `dynamodb:BatchGetItem`, `dynamodb:Query`, `dynamodb:GetItem`, `dynamodb:Scan`, `dynamodb:ConditionCheckItem`, `dynamodb:BatchWriteItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, `dynamodb:DescribeTable` | AgentToolkit-Connections table ARN |
| Allow | `dynamodb:GetRecords`, `dynamodb:GetShardIterator` | AgentToolkit-Connections table ARN |

### 2. DisconnectFn Service Role Default Policy

**Attached to**: AgentToolkit-Disconnect Lambda execution role

| Effect | Actions | Resource |
|---|---|---|
| Allow | `dynamodb:BatchGetItem`, `dynamodb:Query`, `dynamodb:GetItem`, `dynamodb:Scan`, `dynamodb:ConditionCheckItem`, `dynamodb:BatchWriteItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, `dynamodb:DescribeTable` | AgentToolkit-Connections table ARN |
| Allow | `dynamodb:GetRecords`, `dynamodb:GetShardIterator` | AgentToolkit-Connections table ARN |

### 3. MessageFn Service Role Default Policy

**Attached to**: AgentToolkit-Message Lambda execution role

| Effect | Actions | Resource |
|---|---|---|
| Allow | DynamoDB read/write (same 10 actions) | AgentToolkit-Connections table ARN |
| Allow | `dynamodb:GetRecords`, `dynamodb:GetShardIterator` | AgentToolkit-Connections table ARN |
| Allow | DynamoDB read/write (same 10 actions) | AgentToolkit-Messages table ARN |
| Allow | `dynamodb:GetRecords`, `dynamodb:GetShardIterator` | AgentToolkit-Messages table ARN |
| Allow | `bedrock:InvokeModelWithResponseStream` | `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Allow | `bedrock:InvokeModelWithResponseStream` | `arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Allow | `bedrock:InvokeModelWithResponseStream` | `arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Allow | `bedrock:InvokeModelWithResponseStream` | `arn:aws:bedrock:us-east-1:978377355615:inference-profile/us.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Allow | `execute-api:ManageConnections` | `arn:aws:execute-api:us-east-1:978377355615:<api-id>/prod/POST/@connections/*` |

### 4. Resource-Based Policies (Lambda Permissions)

| Lambda Function | Principal | Source ARN |
|---|---|---|
| AgentToolkit-Connect | `apigateway.amazonaws.com` | `arn:aws:execute-api:us-east-1:978377355615:<api-id>/*/$connect` |
| AgentToolkit-Disconnect | `apigateway.amazonaws.com` | `arn:aws:execute-api:us-east-1:978377355615:<api-id>/*/$disconnect` |
| AgentToolkit-Message | `apigateway.amazonaws.com` | `arn:aws:execute-api:us-east-1:978377355615:<api-id>/*/sendMessage` |

## Wildcard Scan Results

### Source Code Scan

Searched all `.ts`, `.mjs`, `.js`, `.json`, `.yaml`, `.yml` files (excluding `node_modules`, `cdk.out`, `package-lock.json`):

- **Occurrences of `Action: "*"` or `Action: *`**: 0
- **Occurrences of `Resource: "*"` or `Resource: *`**: 0

### Synthesized CloudFormation Template Scan

Scanned all `AWS::IAM::Policy` and `AWS::IAM::Role` resources in the synthesized template:

- **`Action: "*"`**: 0 occurrences
- **`Resource: "*"`**: 0 occurrences

### Total Wildcard Count

| Category | Count |
|---|---|
| Wildcard Actions (`Action: "*"`) | **0** |
| Wildcard Resources (`Resource: "*"`) | **0** |
| **Total Wildcards** | **0** |

## Notes

- The `@connections/*` pattern in the `execute-api:ManageConnections` resource is **not** a wildcard IAM permission. The `*` refers to dynamic WebSocket connection IDs that are generated at runtime — there is no way to enumerate them in advance. This is the standard pattern recommended by AWS documentation.
- CDK's `grantReadWriteData()` generates a broader set of DynamoDB actions than strictly needed (e.g., `Scan`, `BatchWriteItem` when only `PutItem`/`GetItem`/`Query`/`DeleteItem` are used). These are scoped to specific table ARNs but could be narrowed further for defense-in-depth.
- The `$connect` route has `authorizationType: NONE` — there is no authentication on the WebSocket API.