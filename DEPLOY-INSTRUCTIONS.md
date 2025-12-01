# Deployment Instructions for Updated Server

## Problem Solved
The `admin.html` file expects `/auth/add-code` and `/auth/validate` endpoints on the server, but the current `whisper-signaling-20.ymgholdings.deno.net` server doesn't have them.

## Solution
Updated `main.js` has been created with:
- ✅ Original WebSocket signaling functionality
- ✅ `/auth/validate` endpoint for access code validation
- ✅ `/auth/add-code` endpoint for admin code generation
- ✅ Password-based admin authentication
- ✅ CORS support for cross-origin requests

## How to Deploy

### Option 1: Update whisper-signaling Repository (Recommended)
1. Copy `main.js` from this repo to the `whisper-signaling` repository
2. Commit and push to the `main` branch
3. If Deno Deploy is linked to GitHub, it will auto-deploy
4. If not linked, manually deploy via Deno Deploy dashboard

### Option 2: Manual Deploy via Deno CLI
```bash
# Install deployctl if not already installed
deno install -Arf --global https://deno.land/x/deploy/deployctl.ts

# Deploy to Deno Deploy
deployctl deploy --project=whisper-signaling-20 --prod main.js
```

### Option 3: Deploy via Deno Deploy Dashboard
1. Go to https://dash.deno.com/projects/whisper-signaling-20
2. Click "Deploy"
3. Upload `main.js` file
4. Click "Deploy"

## Testing After Deployment

Test the health endpoint:
```bash
curl https://whisper-signaling-20.ymgholdings.deno.net/health
```

Test the auth/add-code endpoint:
```bash
curl -X POST https://whisper-signaling-20.ymgholdings.deno.net/auth/add-code \
  -H "Content-Type: application/json" \
  -d '{"password":"YourAdminPassword","code":"TEST123","expiresInHours":24}'
```

Test the auth/validate endpoint:
```bash
curl -X POST https://whisper-signaling-20.ymgholdings.deno.net/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"TEST123"}'
```

## Environment Variables (Optional)
Set in Deno Deploy dashboard under Settings → Environment Variables:
- `ADMIN_PASSWORD_HASH`: Custom SHA-256 hash of your admin password (defaults to existing hash)

## Next Steps
Once deployed, `admin.html` at wh15p3r.link/admin.html will be able to:
1. Accept admin login
2. Generate access codes
3. Automatically add codes to the server
4. Provide copy-to-clipboard functionality for sharing codes
