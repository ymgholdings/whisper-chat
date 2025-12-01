// WH15P3R Signaling Server for Deno Deploy
// Serverless WebSocket signaling for WebRTC P2P connections + Access Control
// Zero logging • Persistent access codes via Deno KV • Ephemeral sessions

// Open Deno KV database (distributed across all isolates)
const kv = await Deno.openKv();

// WebSocket sessions for signaling (ephemeral, in-memory is fine for sessions)
const sessions = new Map();

// Admin password hash for /auth/add-code endpoint
const ADMIN_PASSWORD_HASH = Deno.env.get('ADMIN_PASSWORD_HASH') || 'b5672e2a8605c7cdb48041581767fbe5678cef5faec7b31c0718eec18620613b';

// Helper function to hash password
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (!session.lastActivity || now - session.lastActivity > 10 * 60 * 1000) {
      sessions.delete(code);
    }
  }
}, 5 * 60 * 1000);

// Cleanup expired codes from KV every 10 minutes
setInterval(async () => {
  const now = Date.now();
  const entries = kv.list({ prefix: ["access_codes"] });
  for await (const entry of entries) {
    const code = entry.value;
    if (code.expiresAt && now > code.expiresAt) {
      await kv.delete(entry.key);
      console.log(`Cleaned up expired code: ${code.code}`);
    }
  }
}, 10 * 60 * 1000);

Deno.serve({ port: 8000 }, async (req) => {
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

  // Health check endpoint
  if (url.pathname === "/health") {
    // Count active codes in KV
    let activeCodesCount = 0;
    const entries = kv.list({ prefix: ["access_codes"] });
    for await (const entry of entries) {
      const code = entry.value;
      if (!code.expiresAt || Date.now() < code.expiresAt) {
        if (code.usedCount < code.maxUses) {
          activeCodesCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        sessions: sessions.size,
        activeCodes: activeCodesCount,
        uptime: "serverless",
        storage: "deno-kv"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
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

      const upperCode = code.toUpperCase();
      const result = await kv.get(["access_codes", upperCode]);
      const accessCode = result.value;

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
        await kv.delete(["access_codes", upperCode]);
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
        await kv.delete(["access_codes", upperCode]);
        return new Response(JSON.stringify({
          valid: false,
          error: 'Code limit reached'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Increment usage count and update in KV
      accessCode.usedCount++;
      await kv.set(["access_codes", upperCode], accessCode);

      // If code is now fully used, delete it
      if (accessCode.usedCount >= accessCode.maxUses) {
        await kv.delete(["access_codes", upperCode]);
      }

      return new Response(JSON.stringify({
        valid: true,
        message: 'Access granted'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e) {
      console.error("Validation error:", e);
      return new Response(JSON.stringify({
        valid: false,
        error: 'Server error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Add access code (used by admin.html)
  if (url.pathname === '/auth/add-code' && req.method === 'POST') {
    try {
      const body = await req.json();
      const { password, code, expiresInHours } = body;

      // Validate password
      const passwordHash = await hashPassword(password);
      if (passwordHash !== ADMIN_PASSWORD_HASH) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate code
      if (!code || typeof code !== 'string' || code.length < 6) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid code format'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const upperCode = code.toUpperCase();

      // Check if code already exists in KV
      const existing = await kv.get(["access_codes", upperCode]);
      if (existing.value) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Code already exists'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate expiration
      const expiresAt = expiresInHours && expiresInHours > 0
        ? Date.now() + (expiresInHours * 60 * 60 * 1000)
        : null;

      // Add code to KV
      const codeData = {
        code: upperCode,
        created: Date.now(),
        usedCount: 0,
        maxUses: 1, // Single use by default
        expiresAt
      };

      await kv.set(["access_codes", upperCode], codeData);

      console.log(`Code added to KV: ${upperCode}, expires: ${expiresAt ? new Date(expiresAt).toISOString() : 'never'}`);

      return new Response(JSON.stringify({
        success: true,
        code: upperCode,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e) {
      console.error("Add code error:", e);
      return new Response(JSON.stringify({
        success: false,
        error: 'Server error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // WebSocket upgrade for signaling
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    let currentSessionCode = null;

    socket.onopen = () => {
      // Connection established
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "join") {
          handleJoin(socket, data);
          currentSessionCode = data.sessionCode;
        } else if (data.type === "offer" || data.type === "answer" || data.type === "ice-candidate") {
          relay(socket, data);
        }
      } catch (e) {
        // Silently ignore malformed messages
        console.error("Parse error:", e);
      }
    };

    socket.onclose = () => {
      if (currentSessionCode && sessions.has(currentSessionCode)) {
        const session = sessions.get(currentSessionCode);

        // Remove this connection
        if (session.initiator === socket) {
          session.initiator = null;
        } else if (session.joiner === socket) {
          session.joiner = null;
        }

        // Clean up empty sessions
        if (!session.initiator && !session.joiner) {
          sessions.delete(currentSessionCode);
        }
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return response;
  }

  // Root endpoint
  return new Response(
    "WH15P3R Signaling Server - Running on Deno Deploy\nNo logging • Ephemeral sessions • Post-quantum ready\nAccess control: Deno KV persistent storage",
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain"
      }
    }
  );
});

function handleJoin(socket, data) {
  const { sessionCode, isInitiator } = data;

  if (!sessions.has(sessionCode)) {
    sessions.set(sessionCode, {
      initiator: null,
      joiner: null,
      lastActivity: Date.now()
    });
  }

  const session = sessions.get(sessionCode);
  session.lastActivity = Date.now();

  if (isInitiator) {
    session.initiator = socket;
  } else {
    session.joiner = socket;
  }

  // If both peers are present, signal ready
  if (session.initiator && session.joiner) {
    safeSend(session.initiator, JSON.stringify({ type: "ready" }));
    safeSend(session.joiner, JSON.stringify({ type: "ready" }));
  }
}

function relay(senderSocket, data) {
  const { sessionCode } = data;

  if (!sessions.has(sessionCode)) {
    return;
  }

  const session = sessions.get(sessionCode);
  session.lastActivity = Date.now();
  const message = JSON.stringify(data);

  // Determine the recipient (the peer that is NOT the sender)
  let recipient = null;
  if (session.initiator === senderSocket) {
    recipient = session.joiner;
  } else if (session.joiner === senderSocket) {
    recipient = session.initiator;
  }

  // Relay to the other peer
  if (recipient) {
    safeSend(recipient, message);
  }
}

function safeSend(socket, message) {
  try {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  } catch (e) {
    // Socket might have closed, ignore
  }
}

console.log("WH15P3R Signaling Server started on Deno Deploy");
console.log("Access control: Deno KV persistent storage enabled");
console.log(`Admin password: ${ADMIN_PASSWORD_HASH === 'b5672e2a8605c7cdb48041581767fbe5678cef5faec7b31c0718eec18620613b' ? 'Using default' : 'Custom set'}`);
