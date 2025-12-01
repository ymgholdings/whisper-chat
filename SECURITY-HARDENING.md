# WH15P3R Security Hardening Guide
## Defense Against State-Level Adversaries

### Priority 1: CRITICAL (Implement Immediately)

#### 1. Remove Server Logging
**Current Risk:** Server logs IPs, codes, and timestamps to Deno Deploy console.

**Fix:** Remove all `console.log()` statements that contain:
- Access codes
- IP addresses
- Timestamps of sensitive operations

**Implementation:**
```javascript
// BAD - Logs sensitive data
console.log(`Code validated: ${upperCode} by ${clientIP}`);

// GOOD - No sensitive data
console.log('Code validation completed');
```

#### 2. Implement Zero-Knowledge Architecture
**Goal:** Server should not be able to correlate users even if compromised.

**Changes:**
- Remove IP tracking from successful validations
- Only track failed attempts for rate limiting
- Use hashed IPs for rate limiting (prevents correlation)

**Implementation:**
```javascript
// Hash IP for rate limiting
const ipHash = await hashPassword(clientIP + 'salt');
// Use ipHash instead of raw IP
```

---

### Priority 2: HIGH (Implement Soon)

#### 3. Add WebRTC IP Leak Protection
**Current:** WebRTC can leak real IPs even through VPN.

**Options:**
1. **Force TURN Relay:**
   ```javascript
   iceTransportPolicy: 'relay' // Force all traffic through TURN
   ```

2. **Add Warning in UI:**
   ```
   ⚠️ WARNING: Your IP address is visible to your chat partner.
   For maximum anonymity, use Tor Browser.
   ```

3. **Disable Host Candidates:**
   ```javascript
   // Prevent local IP leaks
   pc.setConfiguration({
     iceServers: [...],
     iceTransportPolicy: 'all',
     // Filter out host candidates
   });
   ```

#### 4. Implement Tor Hidden Service
**Goal:** Make signaling server accessible via `.onion` address.

**Benefits:**
- No DNS lookups
- No TLS SNI leaks
- Hidden from network surveillance
- Tor Browser users get full protection

**Steps:**
1. Set up Tor hidden service pointing to Deno Deploy
2. Add `.onion` address detection in client
3. Automatically use `.onion` when Tor Browser detected

---

### Priority 3: MEDIUM (Enhanced Protection)

#### 5. Domain Fronting via Cloudflare
**Goal:** Hide actual destination from network observers.

**Implementation:**
```javascript
// Client connects to cloudflare.com via SNI
// But sends Host header to actual domain
// Network observer sees: cloudflare.com (common traffic)
// Instead of: whisper-signaling-20.deno.dev (suspicious)
```

#### 6. Multi-Hop Signaling
**Concept:** Route signaling through multiple servers.

**Architecture:**
```
User → Proxy1 → Proxy2 → Signaling Server
```

**Benefit:** No single server knows both endpoints.

#### 7. Decoy Traffic
**Goal:** Make traffic analysis harder.

**Implementation:**
```javascript
// Generate fake WebSocket traffic
// Adds noise to timing analysis
// Makes it harder to correlate sessions
```

---

### Priority 4: LOW (Defense in Depth)

#### 8. Client-Side Encryption of Session Codes
**Goal:** Encrypt session codes in transit to signaling server.

**Implementation:**
```javascript
// Encrypt session code with ephemeral key
// Server can relay but not read
```

#### 9. Add Canary Tokens
**Goal:** Detect if admin panel is compromised.

**Implementation:**
```javascript
// Add unique tracking tokens
// Alert if accessed from unexpected locations
```

#### 10. Implement Perfect Forward Secrecy for Access Codes
**Current:** Codes stored in KV until used.

**Enhanced:**
```javascript
// Encrypt codes in KV with rotating keys
// Even if KV dumped, old codes unrecoverable
```

---

## Threat Model Analysis

### What This System Protects Against:
✅ Mass surveillance of message content (PQ encryption)
✅ Message interception (P2P direct connection)
✅ Retroactive decryption (post-quantum secure)
✅ Passive network monitoring (Tor Browser recommended)
✅ Brute force access (rate limiting + crypto codes)
✅ Code reuse attacks (one-time use)

### What This System CANNOT Protect Against:
❌ Compromised endpoints (malware, keyloggers)
❌ $5 wrench attack (physical coercion)
❌ Browser exploits (zero-days)
❌ Correlation if admin distributes codes carelessly
❌ Traffic analysis if not using Tor
❌ WebRTC IP leaks (unless using Tor Browser)

### State-Level Capabilities This Defends Against:
✅ Quantum computer decryption (post-quantum crypto)
✅ Passive network surveillance (with Tor)
✅ Cloud provider data access (zero storage)
✅ TLS interception (end-to-end encryption)
✅ Rubber-hose cryptanalysis (perfect forward secrecy, ephemeral keys)

### State-Level Capabilities Requiring Additional Work:
⚠️ Active network attacks (MitM) - Needs code verification
⚠️ Timing correlation - Needs decoy traffic
⚠️ Traffic analysis - Needs multi-hop or Tor hidden service
⚠️ Browser fingerprinting - Use Tor Browser

---

## Deployment Recommendations for Maximum Security

### For Paranoid Users:
1. **Access via Tor Browser** (hides IP, browser fingerprint)
2. **Use Tails OS** (leaves no traces)
3. **Verify session code out-of-band** (phone call, in-person)
4. **Use burner devices** (air-gapped if critical)
5. **Distribute codes in person** (no digital trail)

### For Server Operators:
1. **Remove all logging** (Priority 1)
2. **Self-host on VPS** (instead of Deno Deploy)
3. **Set up Tor hidden service** (for Tor Browser users)
4. **Implement domain fronting** (hide traffic pattern)
5. **Use privacy-focused hosting** (Njalla, 1984 Hosting)

### For Maximum Paranoia:
1. **Run signaling server on Raspberry Pi at home** (no cloud)
2. **Use .onion address only** (no clearnet access)
3. **Disable all logging completely** (not even console)
4. **Add client-side encryption for session codes**
5. **Implement mesh networking** (no central server)

---

## Implementation Checklist

- [ ] **CRITICAL:** Remove sensitive console.log() statements
- [ ] **CRITICAL:** Hash IPs for rate limiting instead of storing raw IPs
- [ ] **HIGH:** Add WebRTC IP leak warning in UI
- [ ] **HIGH:** Set up Tor hidden service for signaling
- [ ] **MEDIUM:** Implement domain fronting via Cloudflare
- [ ] **MEDIUM:** Add decoy traffic generation
- [ ] **LOW:** Client-side session code encryption
- [ ] **LOW:** Perfect forward secrecy for access codes in KV

---

## Conclusion

**Current State:** Very strong against mass surveillance, good against targeted surveillance.

**With Priority 1+2:** Excellent protection against state-level adversaries.

**With All Priorities:** Near-maximum protection (within browser constraints).

**Remember:** No system is perfect. Defense in depth + good OPSEC is essential.
