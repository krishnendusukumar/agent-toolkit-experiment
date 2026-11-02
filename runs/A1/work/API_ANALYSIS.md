# API Analysis: Bedrock Integration

## Bedrock API Used

**InvokeModelWithResponseStream**

## API Comparison

| API | Used? | Notes |
|---|---|---|
| `Converse` | NO | High-level conversational API, does not stream |
| `ConverseStream` | NO | High-level streaming conversational API; would be an alternative |
| `InvokeModel` | NO | Low-level non-streaming invocation |
| **`InvokeModelWithResponseStream`** | **YES** | Low-level streaming invocation |

## Implementation Details

### SDK Usage

- **Client**: `BedrockRuntimeClient` from `@aws-sdk/client-bedrock-runtime`
- **Command**: `InvokeModelWithResponseStreamCommand`
- **Source file**: `cdk/lambda/message/index.mjs`, line 3 (import), line 65 (invocation)

### Request Format

The Lambda constructs a raw Anthropic Messages API request body:

```json
{
  "anthropic_version": "bedrock-2023-05-31",
  "max_tokens": 4096,
  "system": "You are a helpful AI assistant. Be concise and helpful.",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

### Response Processing

The streaming response is consumed via an async iterator:

```javascript
for await (const event of response.body) {
  if (event.chunk) {
    const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
    if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
      // Forward chunk to WebSocket client
    }
  }
}
```

Stream events include:
- `message_start` — beginning of response
- `content_block_start` — beginning of a content block
- `content_block_delta` — text delta (the code extracts `chunk.delta.text`)
- `content_block_stop` — end of a content block
- `message_delta` — final usage stats
- `message_stop` — end of response

### IAM Permission

The IAM action is `bedrock:InvokeModelWithResponseStream`, scoped to:
- The foundation model ARN in 3 US regions (us-east-1, us-east-2, us-west-2)
- The inference profile ARN in us-east-1

### Why InvokeModelWithResponseStream Instead of ConverseStream

`InvokeModelWithResponseStream` was chosen over `ConverseStream` because:

1. It provides direct access to the Anthropic Messages API format
2. The request body uses `anthropic_version: 'bedrock-2023-05-31'` for native Anthropic compatibility
3. The raw streaming events provide granular control over chunk processing

`ConverseStream` would be a valid alternative that provides a model-agnostic interface, but requires adapting to the Converse API's message format.
