// Minimal WebRTC Signaling Server
// No logging, no storage, no persistence

const WebSocket = require(‘ws’);
const http = require(‘http’);

const PORT = process.env.PORT || 3000;

// In-memory session storage (ephemeral)
const sessions = new Map();

// Create HTTP server
const server = http.createServer((req, res) => {
// CORS headers for browser access
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET, POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

```
if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
}

if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sessions: sessions.size }));
    return;
}

res.writeHead(404);
res.end();
```

});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on(‘connection’, (ws) => {
let currentSessionCode = null;

```
ws.on('message', (message) => {
    try {
        const data = JSON.parse(message);
        
        if (data.type === 'join') {
            handleJoin(ws, data);
            currentSessionCode = data.sessionCode;
        } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') {
            relay(data);
        }
    } catch (e) {
        // Silently ignore malformed messages
    }
});

ws.on('close', () => {
    if (currentSessionCode && sessions.has(currentSessionCode)) {
        const session = sessions.get(currentSessionCode);
        
        // Remove this connection
        if (session.initiator === ws) {
            session.initiator = null;
        } else if (session.joiner === ws) {
            session.joiner = null;
        }
        
        // Clean up empty sessions
        if (!session.initiator && !session.joiner) {
            sessions.delete(currentSessionCode);
        }
    }
});
```

});

function handleJoin(ws, data) {
const { sessionCode, isInitiator } = data;

```
if (!sessions.has(sessionCode)) {
    sessions.set(sessionCode, {
        initiator: null,
        joiner: null
    });
}

const session = sessions.get(sessionCode);

if (isInitiator) {
    session.initiator = ws;
} else {
    session.joiner = ws;
}

// If both peers are present, signal ready
if (session.initiator && session.joiner) {
    session.initiator.send(JSON.stringify({ type: 'ready' }));
    session.joiner.send(JSON.stringify({ type: 'ready' }));
}
```

}

function relay(data) {
const { sessionCode, type } = data;

```
if (!sessions.has(sessionCode)) {
    return;
}

const session = sessions.get(sessionCode);
const message = JSON.stringify(data);

// Relay to the other peer
if (session.initiator && session.joiner) {
    if (type === 'offer' || type === 'ice-candidate') {
        // From initiator to joiner
        if (session.joiner.readyState === WebSocket.OPEN) {
            session.joiner.send(message);
        }
    } else if (type === 'answer') {
        // From joiner to initiator
        if (session.initiator.readyState === WebSocket.OPEN) {
            session.initiator.send(message);
        }
    }
}
```

}

// Cleanup old sessions every 5 minutes
setInterval(() => {
for (const [code, session] of sessions.entries()) {
const initiatorDead = session.initiator && session.initiator.readyState !== WebSocket.OPEN;
const joinerDead = session.joiner && session.joiner.readyState !== WebSocket.OPEN;

```
    if (initiatorDead && joinerDead) {
        sessions.delete(code);
    }
}
```

}, 5 * 60 * 1000);

server.listen(PORT, () => {
console.log(`Signaling server running on port ${PORT}`);
console.log(‘No logging enabled - operating in secure mode’);
});

// Graceful shutdown
process.on(‘SIGTERM’, () => {
console.log(‘Shutting down…’);
wss.clients.forEach(client => client.close());
server.close(() => {
process.exit(0);
});
});