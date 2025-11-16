# Secure P2P Chat - Deployment Guide (Post-Quantum Edition)

## System Overview

This is a WebRTC-based peer-to-peer chat system with **post-quantum encryption**. It consists of:

1. **Static HTML client** - Can be hosted anywhere (even IPFS)
1. **Minimal signaling server** - Node.js server that only facilitates P2P handshake

**Key Security Features:**

- **Post-quantum cryptography** (ML-KEM/Kyber hybrid) in Chrome 142+, Edge 142+, Firefox 120+
- Messages travel directly peer-to-peer (not through server)
- No message storage anywhere
- Session codes generated client-side
- Signaling server has no logging
- All data is ephemeral
- Protected against future quantum computer attacks

## Post-Quantum Encryption Status (November 2025)

### ✅ Fully PQ-Protected Stack

**Layer 1: TLS Connection to Signaling Server**

- Chrome/Edge/Firefox: TLS 1.3 + X25519MLKEM768 (since 2024)
- Safari: PQ-enabled (October 2025)
- Protection: Quantum-safe connection to server

**Layer 2: WebRTC P2P Messages**

- Chrome 142+: DTLS 1.3 + ML-KEM hybrid (October 2025)
- Edge 142+: DTLS 1.3 + ML-KEM hybrid (via policy or default)
- Firefox 120+: DTLS 1.3 support (PQ integration ongoing)
- Protection: Quantum-safe peer-to-peer messages

**Result:** Complete end-to-end post-quantum protection against “harvest now, decrypt later” attacks

## Part 1: Deploy Signaling Server (Vultr VPS)

### Step 1: Create Vultr VPS

1. Log into Vultr
1. Deploy new instance:
- Location: Stockholm, Sweden (or Amsterdam for EU)
- Type: Cloud Compute - Regular Performance
- Size: $6/month (1 CPU, 1GB RAM) is sufficient
- OS: Ubuntu 22.04 LTS

### Step 2: Initial Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js (v18 LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Create application directory
mkdir -p /opt/secure-chat
cd /opt/secure-chat
```

### Step 3: Deploy Server Code

```bash
# Create package.json
cat > package.json << 'EOF'
{
  "name": "secure-signaling-server",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "ws": "^8.14.2"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF

# Create server.js (copy the server code from the artifact)
nano server.js
# Paste the complete server.js code, save (Ctrl+X, Y, Enter)

# Install dependencies
npm install
```

### Step 4: Configure Firewall

```bash
# Install ufw if not present
apt install -y ufw

# Allow SSH (IMPORTANT - do this first!)
ufw allow 22/tcp

# Allow WebSocket port
ufw allow 3000/tcp

# Enable firewall
ufw --force enable

# Check status
ufw status
```

### Step 5: Start Server with PM2

```bash
# Start server
pm2 start server.js --name secure-chat

# Setup PM2 to start on boot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs secure-chat
```

### Step 6: Setup SSL with Nginx (RECOMMENDED)

```bash
# Install Nginx and Certbot
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/secure-chat << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # CHANGE THIS

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/secure-chat /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx

# Get SSL certificate (AFTER pointing your domain to server IP)
certbot --nginx -d your-domain.com
```

## Part 2: Deploy Static Client

### Option A: Simple Hosting (Namecheap)

1. Save the HTML artifact as `index.html`
1. Edit the SIGNALING_SERVER configuration (search for “const SIGNALING_SERVER” near the top of the JavaScript section):
   
   ```javascript
   const SIGNALING_SERVER = 'wss://your-domain.com'; // or ws://your-ip:3000
   ```
1. Upload `index.html` to your web hosting via FTP/cPanel

### Option B: IPFS (Maximum Censorship Resistance)

```bash
# Install IPFS
wget https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_linux-amd64.tar.gz
tar -xvzf kubo_v0.24.0_linux-amd64.tar.gz
cd kubo
sudo bash install.sh

# Initialize IPFS
ipfs init

# Update index.html with your signaling server address
# Then add to IPFS
ipfs add index.html

# Pin to keep it available
ipfs pin add <hash-from-previous-command>

# Start IPFS daemon
ipfs daemon &

# Your site is now available at:
# https://ipfs.io/ipfs/<your-hash>
# OR via any IPFS gateway
```

### Option C: GitHub Pages (Free, Easy)

1. Create GitHub repository
1. Upload `index.html` (with updated SIGNALING_SERVER)
1. Enable GitHub Pages in repository settings
1. Access via `https://yourusername.github.io/repo-name`

## Part 3: Security Hardening

### Server Security

```bash
# Disable password SSH (use keys only)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Install fail2ban
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Setup automatic security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### Monitoring (Without Logging Messages)

```bash
# Monitor server status only
pm2 monit

# Check health endpoint
curl http://localhost:3000/health
```

## Part 4: Usage Instructions for End Users

### For Maximum Security:

1. **Access via Tor Browser**
- Download Tor Browser from torproject.org
- Access your chat site through Tor
- This hides your IP from the signaling server
1. **Or Use VPN**
- Connect to VPN before accessing chat
- Prevents IP logging at signaling server
1. **Session Workflow:**
- Person A: Click “CREATE NEW SESSION”, share code
- Person B: Enter code, click “JOIN SESSION”
- Both see “SECURE P2P CONNECTION ESTABLISHED”
- Chat directly peer-to-peer
- Click “END” when finished

### What’s Protected:

✓ Message content (encrypted P2P)
✓ No server storage
✓ No device storage
✓ Session codes are random
✓ Direct peer-to-peer after handshake

### What’s NOT Protected:

✗ IP addresses during signaling (use Tor/VPN)
✗ IP addresses visible to chat partner (WebRTC limitation)
✗ Compromised endpoints
✗ Screen recording/keyloggers on device
✗ Browser exploits

## Part 5: Maintenance

### Update Server

```bash
cd /opt/secure-chat
git pull  # if using git
pm2 restart secure-chat
```

### Check Server Health

```bash
pm2 status
pm2 logs secure-chat --lines 50
curl http://localhost:3000/health
```

### Backup (Nothing to Backup!)

This system intentionally stores nothing, so there’s nothing to backup.

## Part 6: Threat Model Limitations

**This system provides:**

- Strong encryption against passive network surveillance
- No server-side message storage
- Ephemeral sessions
- P2P direct communication

**This system CANNOT protect against:**

- State-level adversary with access to your endpoints
- Compromised devices (keyloggers, screen capture)
- Traffic analysis (timing, frequency, IP correlation)
- Browser vulnerabilities
- WebRTC IP leaks (mitigated by Tor/VPN)

**For truly sensitive communications:**

- Use Tor Browser
- Consider Tails OS on USB
- Meet in person for key exchange
- Assume endpoint compromise
- Use air-gapped devices for critical work

## Domain/DNS Recommendations

**DO:**

- Use privacy-protecting registrar (Njalla, 1984 Hosting)
- Enable WHOIS privacy
- Pay with crypto if possible
- Register in privacy-friendly jurisdiction

**DON’T:**

- Use your real name in registration
- Use personal email
- Host DNS with US providers
- Keep logs

## Legal Considerations

This tool provides encryption but doesn’t make you immune to legal pressure. In authoritarian regimes:

- Running this service may draw attention
- Traffic analysis can reveal users even without content
- Server seizure is possible
- Consider operational security carefully

You’re providing a tool. Users are responsible for their usage.

## Support & Updates

For security reasons, this system has no “phone home” functionality. Check for updates manually or setup a private update channel.

-----

**Remember:** Perfect security doesn’t exist. This system significantly raises the bar for surveillance, but determined state-level adversaries have many tools. Use defense in depth.