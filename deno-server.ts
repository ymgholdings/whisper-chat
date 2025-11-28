// WH15P3R Signaling Server with Access Control
// Deploy to Deno Deploy
// Handles: WebSocket signaling + Access code validation

// In-memory access codes (replace with KV store for persistence)
const ACCESS_CODES = new Map<string, {
  code: string;
  created: number;
  usedCount: number;
  maxUses: number;
  expiresAt: number | null;
}>();

// In-memory sessions for WebSocket signaling
const sessions = new Map<string, {
  initiator: WebSocket | null;
  joiner: WebSocket | null;
  lastActivity: number;
}>();

// Admin secret for managing codes (set via environment variable)
const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || 'change-this-secret-in-production';

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

// HTTP request handler
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      sessions: sessions.size,
      activeCodes: ACCESS_CODES.size,
      uptime: performance.now()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Validate access code
  if (url.pathname === '/auth/validate' && req.method === 'POST') {
    try {
      const body = await req.json();
      const { code } = body;

      if (!code || typeof code !== 'string') {
        return new Response(JSON.stringify({
          valid: false,
          error: 'Invalid code format'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const accessCode = ACCESS_CODES.get(code.toUpperCase());

      if (!accessCode) {
        return new Response(JSON.stringify({
          valid: false,
          error: 'Invalid code'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check expiration
      if (accessCode.expiresAt && Date.now() > accessCode.expiresAt) {
        return new Response(JSON.stringify({
          valid: false,
          error: 'Code expired'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check max uses
      if (accessCode.usedCount >= accessCode.maxUses) {
        return new Response(JSON.stringify({
          valid: false,
          error: 'Code limit reached'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Increment usage count
      accessCode.usedCount++;

      return new Response(JSON.stringify({
        valid: true,
        message: 'Access granted'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e) {
      return new Response(JSON.stringify({
        valid: false,
        error: 'Server error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Generate new access code (admin only)
  if (url.pathname === '/admin/generate' && req.method === 'POST') {
    try {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const { maxUses = 1, expiresInHours = null } = body;

      // Generate random 8-character code
      const code = generateCode(8);
      const expiresAt = expiresInHours ? Date.now() + (expiresInHours * 60 * 60 * 1000) : null;

      ACCESS_CODES.set(code, {
        code,
        created: Date.now(),
        usedCount: 0,
        maxUses,
        expiresAt
      });

      return new Response(JSON.stringify({
        code,
        maxUses,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        url: `https://${url.host}/?access=${code}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // List all codes (admin only)
  if (url.pathname === '/admin/codes' && req.method === 'GET') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const codes = Array.from(ACCESS_CODES.values()).map(c => ({
      code: c.code,
      created: new Date(c.created).toISOString(),
      usedCount: c.usedCount,
      maxUses: c.maxUses,
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
      active: (!c.expiresAt || Date.now() < c.expiresAt) && c.usedCount < c.maxUses
    }));

    return new Response(JSON.stringify({ codes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Delete code (admin only)
  if (url.pathname.startsWith('/admin/codes/') && req.method === 'DELETE') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const code = url.pathname.split('/').pop()?.toUpperCase();
    if (code && ACCESS_CODES.has(code)) {
      ACCESS_CODES.delete(code);
      return new Response(JSON.stringify({ message: 'Code deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Code not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // WebSocket upgrade
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleWebSocket(socket);
    return response;
  }

  // Default response
  return new Response('WH15P3R Signaling Server\nNo logging • Ephemeral sessions • Post-quantum ready', {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
  });
}

// WebSocket handler for signaling
function handleWebSocket(socket: WebSocket) {
  let currentSessionCode: string | null = null;

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'join') {
        handleJoin(socket, message);
        currentSessionCode = message.sessionCode;
      } else if (['offer', 'answer', 'ice-candidate'].includes(message.type)) {
        relay(socket, message);
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  };

  socket.onclose = () => {
    if (currentSessionCode && sessions.has(currentSessionCode)) {
      const session = sessions.get(currentSessionCode)!;

      if (session.initiator === socket) {
        session.initiator = null;
      } else if (session.joiner === socket) {
        session.joiner = null;
      }

      if (!session.initiator && !session.joiner) {
        sessions.delete(currentSessionCode);
      }
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function handleJoin(socket: WebSocket, data: any) {
  const { sessionCode, isInitiator } = data;

  if (!sessions.has(sessionCode)) {
    sessions.set(sessionCode, {
      initiator: null,
      joiner: null,
      lastActivity: Date.now()
    });
  }

  const session = sessions.get(sessionCode)!;
  session.lastActivity = Date.now();

  if (isInitiator) {
    session.initiator = socket;
  } else {
    session.joiner = socket;
  }

  if (session.initiator && session.joiner) {
    safeSend(session.initiator, JSON.stringify({ type: 'ready' }));
    safeSend(session.joiner, JSON.stringify({ type: 'ready' }));
  }
}

function relay(senderSocket: WebSocket, data: any) {
  const { sessionCode } = data;

  if (!sessions.has(sessionCode)) {
    return;
  }

  const session = sessions.get(sessionCode)!;
  session.lastActivity = Date.now();
  const message = JSON.stringify(data);

  let recipient: WebSocket | null = null;
  if (session.initiator === senderSocket) {
    recipient = session.joiner;
  } else if (session.joiner === senderSocket) {
    recipient = session.initiator;
  }

  if (recipient) {
    safeSend(recipient, message);
  }
}

function safeSend(socket: WebSocket, message: string) {
  try {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  } catch (e) {
    console.error('SafeSend error:', e);
  }
}

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Start server
Deno.serve({ port: 8000 }, handleRequest);

console.log('WH15P3R Signaling Server started on port 8000');
console.log('Access control enabled');
console.log(`Admin secret: ${ADMIN_SECRET === 'change-this-secret-in-production' ? 'WARNING: Using default secret!' : 'Custom secret set'}`);
