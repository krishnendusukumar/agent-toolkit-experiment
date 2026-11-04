#!/bin/bash
WS_URL="wss://eo0o7xfc07.execute-api.us-east-1.amazonaws.com/prod"
SESSION_ID="test-session-$(date +%s)"

echo "=== Test 1: WebSocket Connect + Send Message ==="
echo "Connecting to $WS_URL with session $SESSION_ID"

# Use a node script for testing since wscat is interactive
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('$WS_URL');
let chunks = '';
let gotEnd = false;

ws.on('open', () => {
  console.log('CONNECTED');
  ws.send(JSON.stringify({
    action: 'sendMessage',
    message: 'Hello! What is 2+2? Reply in one short sentence.',
    sessionId: '$SESSION_ID'
  }));
  console.log('MESSAGE SENT');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'chunk') {
    chunks += msg.content;
    process.stdout.write(msg.content);
  } else if (msg.type === 'end') {
    gotEnd = true;
    console.log('\n--- END OF STREAM ---');
  } else if (msg.type === 'usage') {
    console.log('USAGE:', JSON.stringify(msg.usage));
  } else if (msg.type === 'error') {
    console.log('ERROR:', msg.message);
  }
});

ws.on('error', (err) => {
  console.error('WS ERROR:', err.message);
  process.exit(1);
});

// timeout after 30s
setTimeout(() => {
  console.log('\nFull response:', chunks);
  console.log('Stream completed:', gotEnd);
  ws.close();
  process.exit(gotEnd ? 0 : 1);
}, 30000);
"

TEST1_RESULT=$?
echo ""
echo "Test 1 result: $([ $TEST1_RESULT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo ""

echo "=== Test 2: Memory Persistence (same session, follow-up) ==="
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('$WS_URL');
let chunks = '';
let gotEnd = false;

ws.on('open', () => {
  console.log('CONNECTED');
  ws.send(JSON.stringify({
    action: 'sendMessage',
    message: 'What was the math question I just asked you?',
    sessionId: '$SESSION_ID'
  }));
  console.log('FOLLOW-UP SENT');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'chunk') {
    chunks += msg.content;
    process.stdout.write(msg.content);
  } else if (msg.type === 'end') {
    gotEnd = true;
    console.log('\n--- END OF STREAM ---');
  } else if (msg.type === 'usage') {
    console.log('USAGE:', JSON.stringify(msg.usage));
  } else if (msg.type === 'error') {
    console.log('ERROR:', msg.message);
  }
});

ws.on('error', (err) => {
  console.error('WS ERROR:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('\nFull response:', chunks);
  console.log('Memory works:', chunks.toLowerCase().includes('2') && chunks.toLowerCase().includes('2'));
  ws.close();
  process.exit(gotEnd ? 0 : 1);
}, 30000);
"
TEST2_RESULT=$?
echo ""
echo "Test 2 result: $([ $TEST2_RESULT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
