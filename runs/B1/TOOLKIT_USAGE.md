# Toolkit Usage Log

## Entry 1 — AWS Region Listing (MCP)
- **What was used:** MCP tool `mcp__plugin_aws-agents_awsknowledge__aws___list_regions` (aws-agents plugin)
- **Why it was used:** User asked what AWS regions are available before starting the project.
- **How it helped:** Returned a complete structured list of 38 AWS regions with IDs and names in a single call — no web search needed.

## Entry 2 — AWS CDK Skill
- **What was used:** AWS Skill `aws-core:aws-cdk` via the Skill tool
- **Why it was used:** Loaded before building the CDK stack to get best practices for CDK with API Gateway WebSocket, Lambda, and DynamoDB.
- **How it helped:** Provided guidance on: using `cdk synth --strict` before deploying, `cdk diff` workflow, `grant*()` for inter-resource IAM (used `grantWriteData`, `grantReadWriteData`), `removalPolicy: DESTROY` for DynamoDB tables, setting explicit `env` on stacks, and troubleshooting patterns for deployment failures. Also informed the Node.js runtime version choice.

## Entry 3 — Amazon Bedrock Skill
- **What was used:** AWS Skill `aws-core:amazon-bedrock` via the Skill tool
- **Why it was used:** Needed to understand how to invoke Claude with streaming in a Lambda function and which API to use.
- **How it helped:**
  - Directed use of the **Converse API** (`ConverseStreamCommand`) over `InvokeModel` for streaming — the unified request format across models.
  - Provided the critical warning to **always set `maxTokens` explicitly** to avoid silent quota reservation.
  - SDK reference (`references/sdk-converse-api-typescript.md`) gave exact TypeScript patterns for streaming including event order: `messageStart` → `contentBlockDelta` → `messageStop` → `metadata`.
  - Troubleshooting section identified the "On-demand throughput isn't supported" error and the fix: use inference profile IDs (`us.anthropic.*` prefix) instead of base model IDs.
  - Security guidance informed least-privilege IAM: scoping `bedrock:InvokeModelWithResponseStream` to specific model ARNs rather than using `bedrock:*`.

## Entry 4 — Bedrock SDK TypeScript Reference
- **What was used:** Read the Bedrock skill's reference file `references/sdk-converse-api-typescript.md`
- **Why it was used:** Per skill instructions: "When the user needs SDK code for model invocation, you MUST read the appropriate SDK reference before generating code."
- **How it helped:** Provided production-ready TypeScript patterns including `retryMode: "adaptive"`, `maxAttempts` configuration, streaming event handling loop, and the correct imports from `@aws-sdk/client-bedrock-runtime`. Directly used these patterns in the Lambda `sendMessage.js` handler.

## Entry 5 — Bedrock Inference Profile Discovery
- **What was used:** AWS CLI via boto3: `bedrock.list_inference_profiles()` and `bedrock.list_foundation_models()`
- **Why it was used:** The direct model ID failed with "on-demand throughput isn't supported" — needed to find the correct inference profile ID as recommended by the Bedrock skill troubleshooting section.
- **How it helped:** Discovered `us.anthropic.claude-sonnet-4-5-20250929-v1:0` as the active US inference profile for Claude Sonnet 4.5, which resolved the invocation error. Also revealed that cross-region inference profiles route to multiple US regions, which informed the IAM policy update.

## Entry 6 — AWS API Calls for Deployment Verification
- **What was used:** boto3 API calls to `apigatewayv2` (get_apis, get_routes, get_stages, get_integrations), `lambda` (get_policy), and `cloudformation` (list_stack_resources)
- **Why it was used:** Debugging the initial 403 WebSocket connection error and verifying deployment state.
- **How it helped:** Confirmed that API Gateway routes, integrations, stages, and Lambda permissions were all correctly configured — narrowing the issue to the model invocation layer rather than infrastructure.
