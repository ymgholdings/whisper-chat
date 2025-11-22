// Local Node.js version of the signaling server for testing
// Run with: node local-server.js
// Then update index.html to point to ws://localhost:3000

const WebSocket = require('ws');
const http = require('http');

const sessions = new Map();

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (!session.lastActivity || now - session.lastActivity > 10 * 60 * 1000) {
      sessions.delete(code);
      console.log(`Cleaned up session: ${code}`);
    }
  }
}, 5 * 60 * 1000);

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      sessions: sessions.size,
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WH15P3R Signaling Server - Local Test\nNo logging • Ephemeral sessions • Post-quantum ready');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (socket) => {
  let currentSessionCode = null;

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'join') {
        handleJoin(socket, message);
        currentSessionCode = message.sessionCode;
      } else if (message.type === 'offer' || message.type === 'answer' || message.type === 'ice-candidate') {
        relay(socket, message);
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  });

  socket.on('close', () => {
    if (currentSessionCode && sessions.has(currentSessionCode)) {
      const session = sessions.get(currentSessionCode);

      // Remove this connection
      if (session.initiator === socket) {
        session.initiator = null;
        console.log(`Initiator disconnected from session: ${currentSessionCode}`);
      } else if (session.joiner === socket) {
        session.joiner = null;
        console.log(`Joiner disconnected from session: ${currentSessionCode}`);
      }

      // Clean up empty sessions
      if (!session.initiator && !session.joiner) {
        sessions.delete(currentSessionCode);
        console.log(`Session deleted: ${currentSessionCode}`);
      }
    }
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleJoin(socket, data) {
  const { sessionCode, isInitiator } = data;

  if (!sessions.has(sessionCode)) {
    sessions.set(sessionCode, {
      initiator: null,
      joiner: null,
      lastActivity: Date.now()
    });
    console.log(`New session created: ${sessionCode}`);
  }

  const session = sessions.get(sessionCode);
  session.lastActivity = Date.now();

  if (isInitiator) {
    session.initiator = socket;
    console.log(`Initiator joined session: ${sessionCode}`);
  } else {
    session.joiner = socket;
    console.log(`Joiner joined session: ${sessionCode}`);
  }

  // If both peers are present, signal ready
  if (session.initiator && session.joiner) {
    console.log(`Both peers present in session ${sessionCode}, sending ready signal`);
    safeSend(session.initiator, JSON.stringify({ type: 'ready' }));
    safeSend(session.joiner, JSON.stringify({ type: 'ready' }));
  }
}

function relay(senderSocket, data) {
  const { sessionCode, type } = data;

  if (!sessions.has(sessionCode)) {
    console.log(`Relay failed: session ${sessionCode} not found`);
    return;
  }

  const session = sessions.get(sessionCode);
  session.lastActivity = Date.now();
  const message = JSON.stringify(data);

  // Determine the recipient (the peer that is NOT the sender)
  let recipient = null;
  if (session.initiator === senderSocket) {
    recipient = session.joiner;
    console.log(`Relaying ${type} from initiator to joiner in session ${sessionCode}`);
  } else if (session.joiner === senderSocket) {
    recipient = session.initiator;
    console.log(`Relaying ${type} from joiner to initiator in session ${sessionCode}`);
  } else {
    console.log(`Relay failed: sender not found in session ${sessionCode}`);
  }

  // Relay to the other peer
  if (recipient) {
    safeSend(recipient, message);
  } else {
    console.log(`Relay failed: recipient not available in session ${sessionCode}`);
  }
}

function safeSend(socket, message) {
  try {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    } else {
      console.log(`SafeSend failed: socket not open (state: ${socket?.readyState})`);
    }
  } catch (e) {
    console.error('SafeSend error:', e);
  }
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log('═'.repeat(60));
  console.log('WH15P3R Signaling Server - Local Test Version');
  console.log('═'.repeat(60));
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log('═'.repeat(60));
  console.log('To test:');
  console.log('1. Update index.html: const SIGNALING_SERVER = "ws://localhost:3000"');
  console.log('2. Open index.html in two browser windows');
  console.log('3. Create session in one, join with code in the other');
  console.log('═'.repeat(60));
  console.log('Debugging enabled - all events will be logged below');
  console.log('═'.repeat(60));
  console.log('');
});

console.log('WH15P3R Signaling Server started');
console.log('No logging of message content - operating in secure mode');
console.log('Connection events will be logged for debugging\n');
