# Local Testing Instructions

## Quick Test to Verify the Fix Works

### Step 1: Start the Local Server

```bash
cd /home/user/whisper-chat
node local-server.js
```

You should see:
```
═══════════════════════════════════════════════════════════
WH15P3R Signaling Server - Local Test Version
═══════════════════════════════════════════════════════════
✓ Server running on http://localhost:3000
✓ WebSocket endpoint: ws://localhost:3000
...
```

### Step 2: Create a Test HTML File

```bash
# Copy index.html to index-test.html
cp index.html index-test.html
```

Then edit `index-test.html` and change line 934:

**FROM:**
```javascript
const SIGNALING_SERVER = 'wss://whisper-signaling-20-krdws9zr2wyn.ymgholdings.deno.net';
```

**TO:**
```javascript
const SIGNALING_SERVER = 'ws://localhost:3000';
```

### Step 3: Test the Connection

1. **Open two browser windows** (or use two different browsers)

2. **In Window 1 (Initiator):**
   - Open `index-test.html`
   - Select a mode (Text, Voice, or Video)
   - Check the VPN/Tor confirmation checkbox
   - Click "Start Session"
   - Copy the session code that appears

3. **In Window 2 (Joiner):**
   - Open `index-test.html` in a new window
   - Check the VPN/Tor confirmation checkbox
   - Paste the session code from Window 1
   - Click "Join Session"

4. **Watch the server console** - you should see:
   ```
   New session created: XXXXXXXXXXXX
   Initiator joined session: XXXXXXXXXXXX
   Joiner joined session: XXXXXXXXXXXX
   Both peers present in session XXXXXXXXXXXX, sending ready signal
   Relaying offer from initiator to joiner in session XXXXXXXXXXXX
   Relaying answer from joiner to initiator in session XXXXXXXXXXXX
   Relaying ice-candidate from initiator to joiner in session XXXXXXXXXXXX
   Relaying ice-candidate from joiner to initiator in session XXXXXXXXXXXX
   ...
   ```

5. **In both browser windows** - you should see the status change to:
   - "Q STATUS: PQ SECURE" or "Secure P2P connection established"
   - The setup interface should disappear
   - The chat interface should appear (or media interface for voice/video)

### Step 4: Test the Chat/Media

- **For text mode:** Try sending messages between the two windows
- **For voice mode:** You should hear audio from the other window
- **For video mode:** You should see video from the other window

### Expected Results

✅ **If it works:**
- Peers connect successfully
- Messages/audio/video work
- The fix is working correctly
- **You can now deploy the updated `main.js` to Deno Deploy**

❌ **If it doesn't work:**
- Check the server console for errors
- Check the browser console (F12) for errors
- Let me know what errors you see

## Deploying to Deno Deploy After Testing

Once you confirm the local test works:

```bash
# Merge the fix to main
git checkout main
git merge claude/fix-peer-connection-017z7fXahMR25vQHPLnzZE6K

# Push to GitHub (this should trigger Deno Deploy auto-deployment)
git push origin main
```

Then verify the production deployment works by testing with the original `index.html` (pointing to the Deno Deploy URL).

## Cleanup

After testing, you can:
- Delete `index-test.html`
- Keep `local-server.js` for future debugging
- Stop the local server with Ctrl+C
