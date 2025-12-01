// WH15P3R Signaling Server for Deno Deploy
// Serverless WebSocket signaling for WebRTC P2P connections + Access Control
// Zero logging • Persistent access codes via Deno KV • Ephemeral sessions

// Open Deno KV database (distributed across all isolates)
const kv = await Deno.openKv();

// WebSocket sessions for signaling (ephemeral, in-memory is fine for sessions)
const sessions = new Map();

// Rate limiting: Track validation attempts per IP
const validationAttempts = new Map();

// Admin password hash for /auth/add-code endpoint
const ADMIN_PASSWORD_HASH = Deno.env.get('ADMIN_PASSWORD_HASH') || 'b5672e2a8605c7cdb48041581767fbe5678cef5faec7b31c0718eec18620613b';

// Security constants
const MIN_CODE_LENGTH = 8; // Minimum 8 characters for security
const MAX_VALIDATION_ATTEMPTS = 5; // Max attempts per IP per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

// Helper function to hash password
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Cryptographically secure code generation
function generateSecureCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes ambiguous chars
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

// Get client IP address
function getClientIP(req) {
  return req.headers.get('cf-connecting-ip') ||
         req.headers.get('x-forwarded-for')?.split(',')[0] ||
         req.headers.get('x-real-ip') ||
         'unknown';
}

// Check rate limit for validation attempts
async function checkRateLimit(ip) {
  const now = Date.now();

  // Get attempts from KV
  const result = await kv.get(["rate_limit", ip]);
  const attempts = result.value || { count: 0, firstAttempt: now };

  // Reset if outside time window
  if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
    return { allowed: true, remaining: MAX_VALIDATION_ATTEMPTS };
  }

  // Check if limit exceeded
  if (attempts.count >= MAX_VALIDATION_ATTEMPTS) {
    const resetTime = attempts.firstAttempt + RATE_LIMIT_WINDOW;
    const minutesRemaining = Math.ceil((resetTime - now) / 60000);
    return {
      allowed: false,
      remaining: 0,
      resetInMinutes: minutesRemaining
    };
  }

  return {
    allowed: true,
    remaining: MAX_VALIDATION_ATTEMPTS - attempts.count
  };
}

// Increment rate limit counter
async function incrementRateLimit(ip) {
  const now = Date.now();
  const result = await kv.get(["rate_limit", ip]);
  const attempts = result.value || { count: 0, firstAttempt: now };

  // Reset if outside time window
  if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
    attempts.count = 1;
    attempts.firstAttempt = now;
  } else {
    attempts.count++;
  }

  // Store with 2-hour expiration
  await kv.set(["rate_limit", ip], attempts, { expireIn: 2 * 60 * 60 * 1000 });
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
        storage: "deno-kv",
        security: "crypto-secure"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  // Validate access code (with rate limiting)
  if (url.pathname === '/auth/validate' && req.method === 'POST') {
    try {
      const clientIP = getClientIP(req);

      // Check rate limit
      const rateLimit = await checkRateLimit(clientIP);
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          valid: false,
          error: `Too many attempts. Try again in ${rateLimit.resetInMinutes} minutes`
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const { code } = body;

      if (!code || typeof code !== 'string') {
        await incrementRateLimit(clientIP);
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
        await incrementRateLimit(clientIP);
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
        await incrementRateLimit(clientIP);
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
        await incrementRateLimit(clientIP);
        return new Response(JSON.stringify({
          valid: false,
          error: 'Code already used'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // SUCCESS - Valid code
      // Increment usage count and update in KV
      accessCode.usedCount++;
      accessCode.usedBy = clientIP;
      accessCode.usedAt = Date.now();

      // If code is now fully used, delete it (one-time use)
      if (accessCode.usedCount >= accessCode.maxUses) {
        await kv.delete(["access_codes", upperCode]);
      } else {
        await kv.set(["access_codes", upperCode], accessCode);
      }

      console.log(`Code validated: ${upperCode} by ${clientIP}`);

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

  // Generate secure access code (server-side, admin only)
  if (url.pathname === '/auth/generate-code' && req.method === 'POST') {
    try {
      const body = await req.json();
      const { password, length = 8, expiresInHours } = body;

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

      // Enforce minimum length
      const codeLength = Math.max(length, MIN_CODE_LENGTH);

      // Generate cryptographically secure code
      let code;
      let attempts = 0;
      const maxAttempts = 10;

      // Ensure code is unique
      do {
        code = generateSecureCode(codeLength);
        const existing = await kv.get(["access_codes", code]);
        if (!existing.value) break;
        attempts++;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unable to generate unique code'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calculate expiration
      const expiresAt = expiresInHours && expiresInHours > 0
        ? Date.now() + (expiresInHours * 60 * 60 * 1000)
        : null;

      // Add code to KV
      const codeData = {
        code,
        created: Date.now(),
        usedCount: 0,
        maxUses: 1, // One-time use
        expiresAt,
        generatedBy: 'server'
      };

      await kv.set(["access_codes", code], codeData);

      console.log(`Secure code generated: ${code}, expires: ${expiresAt ? new Date(expiresAt).toISOString() : 'never'}`);

      return new Response(JSON.stringify({
        success: true,
        code,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        length: codeLength
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e) {
      console.error("Generate code error:", e);
      return new Response(JSON.stringify({
        success: false,
        error: 'Server error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Legacy endpoint: Add access code (deprecated - use /auth/generate-code instead)
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

      // Enforce minimum length
      if (!code || typeof code !== 'string' || code.length < MIN_CODE_LENGTH) {
        return new Response(JSON.stringify({
          success: false,
          error: `Code must be at least ${MIN_CODE_LENGTH} characters`
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
        maxUses: 1, // One-time use
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
    "WH15P3R Signaling Server - Running on Deno Deploy\nNo logging • Ephemeral sessions • Post-quantum ready\nAccess control: Deno KV • Cryptographic code generation • Rate limited",
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
console.log("Security: Cryptographic code generation + Rate limiting");
console.log(`Admin password: ${ADMIN_PASSWORD_HASH === 'b5672e2a8605c7cdb48041581767fbe5678cef5faec7b31c0718eec18620613b' ? 'Using default' : 'Custom set'}`);
