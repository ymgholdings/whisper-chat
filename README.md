# WH15P3R

Post-quantum encrypted peer-to-peer chat system with zero data storage.

-----

## Features

- ✅ **Post-Quantum Encryption** - ML-KEM/Kyber hybrid (Chrome 142+, Firefox 120+)
- ✅ **Direct P2P** - WebRTC data channels, no message relay
- ✅ **Zero Storage** - No databases, no logs, completely ephemeral
- ✅ **No Registration** - No accounts, phone numbers, or personal data
- ✅ **Browser-Based** - No installation required
- ✅ **Cross-Platform** - Works on desktop, mobile, all modern browsers
- ✅ **Open Source** - Auditable code, transparent security

-----

## Quick Start

### For Users

1. **Visit the app** (once deployed)
1. **Click “WH15P3R CHAT”** to generate a session code
1. **Share code** with your contact via separate channel (phone, Signal, in-person)
1. **Verify code out-of-band** when prompted
1. **Chat securely** - Green border means quantum-resistant encryption active
1. **Click “END”** when finished - all keys destroyed

**For maximum security:** Use Tor Browser

-----

## Deployment

### Current Setup

**Signaling Server:**

- Platform: Deno Deploy (serverless)
- Repository: [whisper-signaling](https://github.com/ymgholdings/whisper-signaling)
- URL: `https://whisper-signaling-20.ymgholdings.deno.net`
- Cost: FREE

**Client:**

- Platform: GitHub Pages (or custom hosting)
- Repository: This repo
- Domain: WH15P3R.link (when configured)
- Cost: FREE (plus domain registration)

### Deploy Your Own

#### 1. Deploy Signaling Server

**Option A: Use Our Server (Easiest)**

- Use existing: `wss://whisper-signaling-20.ymgholdings.deno.net`
- No setup needed

**Option B: Deploy Your Own (Recommended for Privacy)**

```bash
# Fork whisper-signaling repo
# Connect to Deno Deploy
# Get your own serverless endpoint
# Update client with your URL
```

See [Signaling Server Repo](https://github.com/ymgholdings/whisper-signaling) for details.

#### 2. Deploy Client

**Via GitHub Pages (Free):**

1. Fork this repository
1. Update `index.html` line ~482 with your signaling server URL:
   
   ```javascript
   const SIGNALING_SERVER = 'wss://your-server.deno.dev';
   ```
1. Go to Settings → Pages
1. Source: Deploy from `main` branch
1. Access at: `https://yourusername.github.io/whisper-chat/`

**With Custom Domain:**

1. Follow GitHub Pages setup above
1. Add custom domain in GitHub Pages settings
1. Update DNS records at your registrar
1. Enable HTTPS (automatic via GitHub)

-----

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Client (Browser)                   │
│  • Post-quantum encryption (ML-KEM)            │
│  • Session code generation                     │
│  • WebRTC P2P connection                       │
│  • User interface                              │
└─────────────────────────────────────────────────┘
                        │
                        │ TLS 1.3 + ML-KEM
                        ↓
┌─────────────────────────────────────────────────┐
│         Signaling Server (Deno Deploy)          │
│  • WebRTC handshake coordination                │
│  • No message content access                    │
│  • Zero data storage                           │
│  • Ephemeral sessions only                     │
└─────────────────────────────────────────────────┘
                        │
                        │ WebRTC signaling
                        ↓
              P2P Connection Established
                        ↓
         ┌──────────────┴──────────────┐
         │                             │
    Client A ←─────────────────────→ Client B
         DTLS 1.3 + ML-KEM (Direct P2P)
         Post-Quantum Encrypted Messages
         No Server Involvement
```

-----

## Security

### Cryptographic Stack

**Layer 1: TLS 1.3 (Client ↔ Signaling Server)**

- Algorithm: X25519MLKEM768 (hybrid classical + post-quantum)
- Purpose: Protects session code exchange
- Status: Active in Chrome 142+, Firefox 128+, Safari 17.2+

**Layer 2: DTLS 1.3 (Peer-to-Peer)**

- Algorithm: DTLS 1.3 + ML-KEM hybrid key agreement
- Encryption: AES-256-GCM
- Purpose: Encrypts actual chat messages
- Status: Active in Chrome 142+, Edge 142+, Firefox 120+

### What’s Protected

✅ **Message Content** - End-to-end encrypted, quantum-resistant  
✅ **Future-Proof** - Protected against future quantum computers  
✅ **Server Seizure** - Nothing stored to seize  
✅ **Retroactive Surveillance** - Keys destroyed after session  
✅ **Data Breaches** - No data to breach

### What’s NOT Protected

❌ **Endpoint Security** - Cannot protect compromised devices  
❌ **Metadata** - Connection timing/patterns visible (use Tor)  
❌ **Physical Coercion** - No crypto protects against this  
❌ **Screen Recording** - Messages visible on screen

### Recommended Security Practices

**For All Users:**

- ✅ Use Chrome 142+ or Firefox 120+ for post-quantum encryption
- ✅ Verify session codes out-of-band (phone call, in-person)
- ✅ Close browser when finished (destroys keys)

**For High-Risk Users:**

- ✅ Access via Tor Browser (hides IP addresses)
- ✅ Use Tails OS (leaves no traces on device)
- ✅ Verify you see “🔒 Q POST-QUANTUM ACTIVE” badge
- ✅ Meet in person for initial code exchange
- ✅ Assume endpoints may be compromised

See <USER_GUIDE.md> for complete security guidance.

-----

## Documentation

- **<SECURITY.md>** - Complete security assessment and threat model
- **<USER_GUIDE.md>** - User security guide for different threat levels
- **<DEPLOYMENT.md>** - Detailed deployment instructions
- **<ARCHITECTURE.md>** - Technical architecture overview

-----

## Browser Compatibility

### Post-Quantum Encryption Support

|Browser    |Version|PQ Status                       |
|-----------|-------|--------------------------------|
|Chrome     |142+   |✅ Full support (October 2025)   |
|Edge       |142+   |✅ Full support (October 2025)   |
|Firefox    |120+   |✅ Full support (November 2024)  |
|Safari     |17.2+  |✅ TLS support (October 2025)    |
|Tor Browser|Latest |✅ Based on Firefox (recommended)|

**Fallback:** Older browsers use strong classical encryption (still secure against current threats, not quantum-resistant)

-----

## Cost Breakdown

**Serverless Setup (Recommended):**

- Signaling Server (Deno Deploy): **FREE**
- Client Hosting (GitHub Pages): **FREE**
- Domain (WH15P3R.link): **$12/year**
- SSL Certificates: **FREE** (automatic)

**Total: $12/year** (just domain cost)

**Alternative with VPS Backup:**

- Above setup + Vultr Sweden VPS: **$84/year**
- Provides jurisdictional redundancy

-----

## Comparison to Other Systems

|Feature                    |WH15P3R|Signal    |Session|Matrix    |
|---------------------------|-------|----------|-------|----------|
|**Post-Quantum (Deployed)**|✅ Yes  |⚠️ Planned |❌ No   |❌ No      |
|**No Registration**        |✅ Yes  |❌ Phone#  |✅ Yes  |⚠️ Optional|
|**Zero Storage**           |✅ Yes  |⚠️ Metadata|✅ Yes  |❌ No      |
|**Browser-Based**          |✅ Yes  |⚠️ Web app |❌ No   |✅ Yes     |
|**True P2P**               |✅ Yes  |❌ Server  |✅ Yes  |❌ Server  |
|**No Installation**        |✅ Yes  |❌ App     |❌ App  |⚠️ Web     |

**Unique Combination:** Only system with deployed PQ encryption + zero registration + truly ephemeral + browser-based + direct P2P.

-----

## Use Cases

**✅ Appropriate For:**

- Journalists communicating with sources
- Business confidential communications
- Privacy-conscious general users
- Activists in partially-free countries
- Anyone concerned about quantum future-proofing
- Technical professionals needing quick secure chat

**⚠️ Not Ideal For:**

- High-risk dissidents under active surveillance (use Tails + Tor)
- Users who need persistent chat history
- Group communications (currently 1-on-1 only)
- File transfers (text only currently)
- Non-technical users in high-threat environments

-----

## Contributing

**Security Issues:**

- Report via GitHub Issues (private security advisory)
- Email: [security contact if you add one]

**Code Contributions:**

- Fork repository
- Create feature branch
- Submit pull request
- Follow existing code style

**Documentation:**

- Improvements welcome
- Translations appreciated
- User guides for different threat models

-----

## Threat Model

### Protects Against

✅ Network surveillance (ISP, government)  
✅ Future quantum computer attacks  
✅ Server compromise/seizure  
✅ Retroactive data requests  
✅ Man-in-the-middle (with out-of-band verification)

### Does NOT Protect Against

❌ Compromised endpoints (malware, keyloggers)  
❌ Physical device access  
❌ Coercion/torture  
❌ State-level targeted surveillance (combine with physical security)  
❌ Traffic analysis without Tor

**Reality:** No encryption protects compromised endpoints. Use defense in depth.

-----

## Roadmap

**Completed:**

- ✅ Post-quantum encryption (ML-KEM)
- ✅ WebRTC P2P connections
- ✅ Ephemeral sessions (zero storage)
- ✅ Browser-based (no installation)
- ✅ Out-of-band verification prompts
- ✅ User security guide
- ✅ Serverless deployment

**Potential Future:**

- ⏳ Group chat support
- ⏳ File transfer (encrypted)
- ⏳ Voice/video calls
- ⏳ Mobile app wrapper
- ⏳ Tor hidden service (.onion)
- ⏳ Independent security audit

-----

## Legal

**Privacy:**

- No data collection
- No user tracking
- No analytics
- No cookies

**GDPR Compliance:**

- No personal data stored
- No data retention
- Nothing to erase or export

**Liability:**

- Provided as-is
- No warranties
- Users responsible for lawful use
- Encryption tools are legal in most jurisdictions

-----

## FAQ

**Q: Is this really quantum-resistant?**  
A: Yes, when using Chrome 142+, Edge 142+, or Firefox 120+. Uses NIST-standardized ML-KEM (FIPS 203).

**Q: Can the government read my messages?**  
A: They cannot decrypt messages in transit (even with quantum computers). But they CAN compromise your endpoint device.

**Q: Do I need to trust the server?**  
A: Server only sees random session codes and connection metadata. Message content is end-to-end encrypted P2P.

**Q: Why not just use Signal?**  
A: Signal is excellent. WH15P3R offers: deployed post-quantum (not planned), no phone number, no metadata storage, truly ephemeral. Different use cases.

**Q: Is this secure for journalists/activists?**  
A: Yes, for medium-risk scenarios. Combine with Tor Browser and proper operational security. Read USER_GUIDE.md for your threat level.

**Q: Can this be traced back to me?**  
A: Use Tor Browser to hide your IP. The system stores nothing, but network traffic patterns are visible without Tor.

**Q: What happens if I lose connection?**  
A: Session ends, all keys destroyed. Start new session with new code.

-----

## Acknowledgments

- **NIST** - Post-Quantum Cryptography Project
- **WebRTC Working Group** - P2P standards
- **Deno Team** - Serverless platform
- **Browser Vendors** - Chrome, Firefox, Safari teams for PQ implementation
- **Cryptography Community** - For ML-KEM development and analysis

-----

## License

Open Source - Use Responsibly

-----

## Contact

**Project Repository:** https://github.com/ymgholdings/whisper-chat  
**Signaling Server:** https://github.com/ymgholdings/whisper-signaling  
**Issues:** GitHub Issues  
**Security:** Private security advisory on GitHub

-----

**Last Updated:** November 2025  
**Version:** 1.0.0  
**Status:** Production Ready
