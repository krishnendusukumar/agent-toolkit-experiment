# Comparison Notes — AWS Agent Toolkit Impact

## 1. AWS Skills Used

| Skill | Invocation | Purpose |
|---|---|---|
| `aws-core:aws-cdk` | Loaded via Skill tool before writing any CDK code | CDK best practices, deployment workflow, IAM patterns, troubleshooting |
| `aws-core:amazon-bedrock` | Loaded via Skill tool before writing Lambda handlers | API selection (Converse vs InvokeModel), streaming patterns, model ID formats, IAM scoping, troubleshooting |

Both skills were loaded **proactively before writing code**, not reactively after hitting errors. This front-loaded expertise into the implementation phase rather than the debugging phase.

## 2. AWS Documentation Consulted

| Source | How Accessed | What It Provided |
|---|---|---|
| Bedrock SDK TypeScript reference (`sdk-converse-api-typescript.md`) | Read from skill's bundled reference files | Exact `ConverseStreamCommand` patterns, imports, client config (`retryMode: "adaptive"`, `maxAttempts`), streaming event order |
| Bedrock model invocation reference | Embedded in skill's main guidance | API landscape table (5 endpoints), `maxTokens` reservation mechanics, retry classification table |
| Bedrock troubleshooting section | Embedded in skill's main guidance | "On-demand throughput isn't supported" error pattern and fix (inference profile IDs) |
| CDK troubleshooting section | Embedded in skill's main guidance | Runtime deprecation warnings, `cdk synth --strict` validation workflow |
| MCP `aws___list_regions` tool | Called directly via MCP | Structured region data (38 regions with IDs and names) |
| MCP `aws___list_foundation_models` | Called via boto3 (equivalent) | Available model IDs in us-east-1 |
| MCP `aws___list_inference_profiles` | Called via boto3 (equivalent) | Inference profile IDs for cross-region invocation |

Key distinction: the skill references were **bundled, curated documentation** — not raw AWS docs. They distilled thousands of pages into actionable patterns with explicit warnings about common mistakes.

## 3. Deployment Issues Solved Using Toolkit Guidance

### Issue 1: Model invocation fails — "on-demand throughput isn't supported"
- **Error:** `Invocation of model ID anthropic.claude-sonnet-4-5-20250929-v1:0 with on-demand throughput isn't supported`
- **Toolkit contribution:** The Bedrock skill's troubleshooting section has an explicit entry for this exact error: *"Fix: find the inference profile ID for the model using `aws bedrock list-inference-profiles`."* Without this, the error message alone ("retry with the ID or ARN of an inference profile") is vague — you'd need to know what an inference profile is, that they have geographic prefixes (`us.`, `eu.`, `global.`), and how to discover them.
- **Resolution time:** Minutes, because the skill prescribed the exact diagnostic command and fix pattern.

### Issue 2: Cross-region IAM permissions for inference profiles
- **Error:** `User is not authorized to perform bedrock:InvokeModelWithResponseStream on resource: arn:aws:bedrock:us-east-2::foundation-model/...`
- **Toolkit contribution:** The Bedrock skill's documentation on cross-region inference profiles explained that `us.` prefix profiles route requests to **any US commercial region** — not just the region you call from. This is non-obvious: you'd expect a call from us-east-1 to stay in us-east-1. The skill's model selection section explicitly states: *"choose between geographic profiles (data stays within a boundary, e.g. US, EU) or global profiles (any commercial region). The profile prefix is a data residency decision."*
- **Resolution:** Added foundation model ARNs for us-east-1, us-east-2, and us-west-2 to the IAM policy.

### Issue 3: Avoiding silent quota exhaustion
- **Potential issue (prevented):** Not setting `maxTokens` causes the model to reserve its maximum (64K for Claude), silently consuming 43x more quota than needed.
- **Toolkit contribution:** The Bedrock skill flags this as a **Critical Warning** and repeats it in the troubleshooting section, the SDK reference, and the quick-start examples. It was the single most emphasized point in the skill. We set `maxTokens: 1024` from the start, avoiding what the skill calls *"the #1 cause of unexpected ThrottlingException."*

## 4. Architecture Decisions Influenced by Toolkit Recommendations

| Decision | What toolkit recommended | What we might have done without it |
|---|---|---|
| **Converse API over InvokeModel** | Bedrock skill: *"Use the Converse API over InvokeModel. It provides a unified request/response format across all models."* Used `ConverseStreamCommand`. | Might have used `InvokeModelWithResponseStream` with Anthropic-specific request body format — works, but ties the code to one provider's schema. |
| **Inference profile ID (`us.` prefix)** | Bedrock skill's model selection section recommends cross-region IDs for higher availability. | Would have used the base model ID directly, which fails for this model. Would have required extra debugging. |
| **`maxTokens` set explicitly** | Bedrock skill: Critical Warning, repeated 4 times across different sections. | Might have omitted it, relying on a "reasonable default" — which is actually the model maximum (64K tokens). |
| **Adaptive retry mode** | SDK reference: `retryMode: "adaptive"` with `maxAttempts: 5`. | Might have used default retry (standard mode, 3 attempts), which doesn't include client-side rate limiting. |
| **CDK `grant*()` methods for IAM** | CDK skill: *"Use `grant*()` for inter-resource IAM."* | Might have written inline IAM policies manually, which is more error-prone and verbose. `grantWriteData()` and `grantReadWriteData()` generate correctly scoped policies automatically. |
| **`cdk synth --strict` before deploy** | CDK skill: workflow table recommends `synth --strict` → `diff` → `deploy`. | Might have deployed directly, missing the runtime deprecation warning (nodejs20.x) that `--strict` surfaced. |
| **Explicit `env` on stack** | CDK skill: *"Set explicit `env: { account, region }` on stack."* | Might have used environment-agnostic stack, which breaks region-dependent features like the inference profile ARN construction. |
| **Scoped Bedrock IAM** | Bedrock skill security section: *"Scope IAM permissions to specific actions and resource ARNs — avoid `bedrock:*`."* | Might have used `bedrock:*` or `AmazonBedrockFullAccess` for convenience. |

## 5. Why This Deployment Would Have Been Harder Without AWS Agent Toolkit

### The inference profile problem would have been a significant time sink
The most impactful toolkit contribution was resolving the inference profile requirement. Without the Bedrock skill:
- The spec says use `anthropic.claude-sonnet-4-5-20250929` — a model ID format that doesn't work for direct invocation
- The error message mentions "inference profiles" but doesn't explain the concept, the geographic prefix system, or how to discover them
- You'd need to read multiple AWS documentation pages to understand inference profiles, then find the right one via API
- The subsequent cross-region IAM issue (us-east-2 routing) would be another research detour

The toolkit had a **named troubleshooting entry** for this exact error with a **prescribed fix**, turning what could be 30+ minutes of documentation spelunking into a 2-minute lookup.

### Preventive guidance avoided production-grade mistakes
The `maxTokens` warning is the best example. Without the toolkit, the application would have deployed and appeared to work — but under load, it would silently reserve 43x more quota per request than needed, causing throttling that looks like an AWS capacity issue rather than a client-side configuration mistake. This is the kind of subtle bug that takes hours to diagnose in production.

### Curated references beat raw documentation
The Bedrock SDK reference (`sdk-converse-api-typescript.md`) is roughly 170 lines. The equivalent information is spread across the Bedrock User Guide (hundreds of pages), the AWS SDK v3 API reference, and multiple blog posts. The skill's reference gave exact import paths, a complete streaming loop, retry configuration, and the event order — all in one file, pre-validated as working patterns.

### The CDK skill provided guardrails, not just guidance
The CDK skill's troubleshooting section meant that when `cdk synth --strict` surfaced the runtime deprecation warning, I already knew this was a real issue (not just noise) and the fix (upgrade to nodejs22.x). Without the skill, it's tempting to ignore CDK warnings as verbose output.

### Bottom line
The toolkit compressed what would be a multi-hour research-build-debug cycle into a structured sequence:
1. Load skills (front-load expertise)
2. Build with recommended patterns (avoid common mistakes)
3. Deploy and hit one issue (inference profiles)
4. Resolve using the skill's troubleshooting section (prescriptive fix)
5. Hit the cascading IAM issue (understood immediately because the skill explained cross-region routing)

**Without the toolkit**, steps 3-5 would each have been independent research projects. The toolkit's value isn't that it makes easy things easier — it's that it makes **non-obvious failure modes diagnosable** and **subtle best practices discoverable** at the point of use.
