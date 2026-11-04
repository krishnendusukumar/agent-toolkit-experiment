# Toolkit Usage Log

## Entry 1 — AWS Region Listing
- **What was used:** MCP tool `mcp__plugin_aws-agents_awsknowledge__aws___list_regions` (from the `aws-agents` plugin)
- **Why it was used:** The user asked "what AWS regions are available?" — this MCP tool provides a structured, up-to-date list of all AWS regions directly from the plugin's knowledge base.
- **How it helped:** Returned a complete list of 38 AWS regions with both region IDs and human-readable names, which was then formatted into a grouped table for the user. No manual lookup or web search was needed — the plugin provided authoritative data in a single call.

## Entry 2 — AWS CDK Skill
- **What was used:** AWS Skill `aws-core:aws-cdk` via the Skill tool
- **Why it was used:** Loaded before building the CDK stack to get best practices for CDK with API Gateway WebSocket, Lambda, and DynamoDB.
- **How it helped:** Provided guidance on: `cdk synth --strict` before deploying, `grant*()` for least-privilege IAM, `removalPolicy: DESTROY` for tables, and troubleshooting patterns. Informed the Node.js runtime version choice (nodejs22.x vs deprecated nodejs20.x).

## Entry 3 — Amazon Bedrock Skill
- **What was used:** AWS Skill `aws-core:amazon-bedrock` via the Skill tool
- **Why it was used:** Needed to understand how to invoke Claude with streaming in a Lambda function.
- **How it helped:** Directed use of Converse API (`ConverseStreamCommand`) over InvokeModel. Provided critical warning to always set `maxTokens` explicitly. Identified the "on-demand throughput not supported" error and fix (use inference profile IDs). Informed least-privilege IAM scoping.

## Entry 4 — Bedrock SDK TypeScript Reference
- **What was used:** Bedrock skill reference file `references/sdk-converse-api-typescript.md`
- **Why it was used:** Per skill instructions, MUST read SDK reference before generating model invocation code.
- **How it helped:** Provided production-ready TypeScript streaming patterns, correct imports, `retryMode: "adaptive"` config, and event handling loop — directly used in the Lambda handler.

## Entry 5 — Bedrock Inference Profile Discovery
- **What was used:** boto3 `bedrock.list_inference_profiles()` and `bedrock.list_foundation_models()`
- **Why it was used:** Direct model ID failed; needed inference profile ID per Bedrock skill troubleshooting.
- **How it helped:** Found `us.anthropic.claude-sonnet-4-5-20250929-v1:0` and revealed cross-region routing behavior, which informed the multi-region IAM policy fix.

## Entry 6 — AWS API Calls for Debugging
- **What was used:** boto3 calls to `apigatewayv2`, `lambda`, and `cloudformation` APIs
- **Why it was used:** Debugging 403 WebSocket error and verifying deployment state.
- **How it helped:** Confirmed infrastructure was correctly configured, narrowing the issue to the model invocation layer.
