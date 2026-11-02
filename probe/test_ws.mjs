import WebSocket from 'ws';

const WS_URL = 'wss://p13p3z5uql.execute-api.us-east-1.amazonaws.com/prod';
const SESSION_ID = 'test-session-' + Date.now();

console.log('Connecting to:', WS_URL);
console.log('Session ID:', SESSION_ID);

const ws = new WebSocket(`${WS_URL}?sessionId=${SESSION_ID}`);

let fullResponse = '';
let testPhase = 1;

ws.on('open', () => {
  console.log('Connected!');
  console.log('\n--- Test 1: Send first message ---');
  ws.send(JSON.stringify({
    action: 'sendMessage',
    message: 'Hello! My name is TestUser. Remember that.',
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.type === 'start') {
    console.log('[Stream start]');
    fullResponse = '';
  } else if (msg.type === 'chunk') {
    process.stdout.write(msg.text);
    fullResponse += msg.text;
  } else if (msg.type === 'end') {
    console.log('\n[Stream end]');
    console.log('Full response length:', fullResponse.length);

    if (testPhase === 1) {
      testPhase = 2;
      console.log('\n--- Test 2: Send follow-up to test memory ---');
      setTimeout(() => {
        ws.send(JSON.stringify({
          action: 'sendMessage',
          message: 'What is my name? You should remember it from my previous message.',
        }));
      }, 1000);
    } else if (testPhase === 2) {
      console.log('\n--- Tests complete ---');
      const memoryWorks = fullResponse.toLowerCase().includes('testuser');
      console.log('Streaming works: YES');
      console.log('Memory works:', memoryWorks ? 'YES' : 'NEEDS REVIEW');
      ws.close();
    }
  } else if (msg.type === 'error') {
    console.error('Error:', msg.message);
    ws.close();
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
});

ws.on('close', () => {
  console.log('Disconnected');
  process.exit(0);
});

setTimeout(() => {
  console.error('Timeout after 60s');
  process.exit(1);
}, 60000);
