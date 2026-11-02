import React, { useState, useRef, useEffect, useCallback } from 'react';

const WS_URL = process.env.REACT_APP_WS_URL || '';

function generateSessionId() {
  return 'sess-' + Math.random().toString(36).substring(2, 10);
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [wsUrl, setWsUrl] = useState(WS_URL);
  const [showConfig, setShowConfig] = useState(!WS_URL);
  const wsRef = useRef(null);
  const sessionIdRef = useRef(generateSessionId());
  const streamBufferRef = useRef('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const connect = useCallback(() => {
    if (!wsUrl) return;

    const url = `${wsUrl}?sessionId=${sessionIdRef.current}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      setShowConfig(false);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setConnected(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'start') {
        setStreaming(true);
        streamBufferRef.current = '';
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      } else if (data.type === 'chunk') {
        streamBufferRef.current += data.text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: streamBufferRef.current,
          };
          return updated;
        });
      } else if (data.type === 'end') {
        setStreaming(false);
      } else if (data.type === 'error') {
        setStreaming(false);
        setMessages(prev => [...prev, { role: 'system', content: `Error: ${data.message}` }]);
      }
    };

    wsRef.current = ws;
  }, [wsUrl]);

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current || streaming) return;

    const msg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');

    wsRef.current.send(JSON.stringify({
      action: 'sendMessage',
      message: msg,
    }));
  };

  const newSession = () => {
    disconnect();
    sessionIdRef.current = generateSessionId();
    setMessages([]);
    setTimeout(connect, 100);
  };

  const styles = {
    container: {
      maxWidth: 720,
      margin: '0 auto',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f9fafb',
    },
    header: {
      padding: '12px 20px',
      borderBottom: '1px solid #e5e7eb',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { margin: 0, fontSize: 18, fontWeight: 600 },
    status: {
      fontSize: 12,
      padding: '4px 10px',
      borderRadius: 12,
      background: connected ? '#dcfce7' : '#fee2e2',
      color: connected ? '#166534' : '#991b1b',
    },
    messagesArea: {
      flex: 1,
      overflowY: 'auto',
      padding: 20,
    },
    message: (role) => ({
      maxWidth: '80%',
      marginBottom: 12,
      padding: '10px 14px',
      borderRadius: 12,
      fontSize: 14,
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
      ...(role === 'user'
        ? { marginLeft: 'auto', background: '#2563eb', color: '#fff' }
        : role === 'system'
        ? { background: '#fef3c7', color: '#92400e' }
        : { background: '#fff', border: '1px solid #e5e7eb' }),
    }),
    form: {
      padding: '12px 20px',
      borderTop: '1px solid #e5e7eb',
      background: '#fff',
      display: 'flex',
      gap: 8,
    },
    input: {
      flex: 1,
      padding: '10px 14px',
      border: '1px solid #d1d5db',
      borderRadius: 8,
      fontSize: 14,
      outline: 'none',
    },
    button: {
      padding: '10px 20px',
      background: '#2563eb',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 14,
      cursor: 'pointer',
    },
    configBox: {
      padding: 20,
      background: '#fff',
      margin: 20,
      borderRadius: 12,
      border: '1px solid #e5e7eb',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Agent Toolkit Chat</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Session: {sessionIdRef.current}
          </span>
          <span style={styles.status}>{connected ? 'Connected' : 'Disconnected'}</span>
          {connected && (
            <button onClick={newSession} style={{ ...styles.button, background: '#6b7280', padding: '4px 12px', fontSize: 12 }}>
              New Session
            </button>
          )}
        </div>
      </div>

      {showConfig && (
        <div style={styles.configBox}>
          <p style={{ margin: '0 0 12px', fontWeight: 500 }}>Enter WebSocket URL</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={styles.input}
              placeholder="wss://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod"
              value={wsUrl}
              onChange={e => setWsUrl(e.target.value)}
            />
            <button style={styles.button} onClick={connect}>Connect</button>
          </div>
        </div>
      )}

      <div style={styles.messagesArea}>
        {messages.length === 0 && connected && (
          <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>
            Send a message to start chatting.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={styles.message(msg.role)}>
            {msg.content}
            {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
              <span style={{ opacity: 0.5 }}>|</span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {connected && (
        <form onSubmit={sendMessage} style={styles.form}>
          <input
            style={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={streaming ? 'Waiting for response...' : 'Type a message...'}
            disabled={streaming}
          />
          <button type="submit" style={{ ...styles.button, opacity: streaming ? 0.5 : 1 }} disabled={streaming}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
