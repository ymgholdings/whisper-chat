# WH15P3R Access Control Setup

## Overview
A minimalist black landing page with single-use code authentication for controlled access to WH15P3R.

## Files Created
- **access.html** - Black landing page where users enter access codes
- **admin.html** - Password-protected admin page to generate codes
- **index.html** - Modified to check for valid access token

## Setup Instructions

### Step 1: Change Admin Password
1. Open `admin.html` in a text editor
2. Generate a new password hash:
   - Open browser console (F12)
   - Run: `crypto.subtle.digest('SHA-256', new TextEncoder().encode('YourNewPassword')).then(h => console.log([...new Uint8Array(h)].map(b => b.toString(16).padStart(2,'0')).join('')))`
   - Copy the hash output
3. Replace line 121 in admin.html:
   ```javascript
   const ADMIN_PASSWORD_HASH = 'YOUR_NEW_HASH_HERE';
   ```

### Step 2: Generate Access Codes
1. Open `admin.html` in your browser
2. Login with your admin password
3. Set code length (6-8 characters) and number of codes
4. Click "GENERATE CODES"
5. Copy the **HASH** from each generated code (use "COPY HASH" button)

### Step 3: Add Hashes to access.html
1. Open `access.html` in a text editor
2. Find line 94: `const validCodes = new Set([`
3. Add each hash on a new line:
   ```javascript
   const validCodes = new Set([
     "abc123def456...",
     "789xyz012...",
     // Add more hashes here
   ]);
   ```

### Step 4: Share Codes with Users
- Give users the **CODE** (e.g., "A7X9K2") - NOT the hash
- Each code works only once
- Codes expire when used
- Users must enter code at www.wh15p3r.link/access.html

### Step 5: Configure Your Domain
Make `access.html` the default landing page:
- Rename `access.html` to `index.html` (and rename current `index.html` to `app.html`)
- OR configure your web server to serve `access.html` as the default page
- OR add a redirect from your current index to access.html

## How It Works

1. User visits www.wh15p3r.link
2. Redirected to access.html (black landing page)
3. Enters 6-8 character code
4. Code is hashed with SHA-256 and checked against valid codes
5. If valid and unused, code is marked as used (localStorage)
6. Access token stored in sessionStorage (expires when browser closes)
7. User redirected to main app (index.html)
8. If user tries to access app directly without valid token, redirected back to access.html

## Security Features

- **Hashed codes**: Even viewing source code won't reveal valid codes
- **Single-use**: Each code can only be used once (tracked in localStorage)
- **Session-based**: Access expires when browser closes
- **Password-protected admin**: Only you can generate codes
- **No server-side storage**: All validation happens client-side (privacy-focused)

## Testing

1. Generate a test code in admin.html
2. Add the hash to access.html
3. Visit access.html and enter the code
4. Should redirect to main app
5. Close browser and try again - should be blocked
6. Try the same code again - should show "CODE ALREADY USED"

## Maintenance

### Clear Used Codes
To reset all used codes (allow codes to be reused):
1. Open browser console
2. Run: `localStorage.removeItem('wh15p3r_used_codes')`

### Generate New Codes
- Use admin.html whenever you need new codes
- Old codes remain valid until used
- You can have multiple active codes at once

## Customization

### Change Colors
Edit the CSS in `access.html`:
- Background: `#000` (black)
- Text: `#0f0` (green)
- Cursor/effects: `#0ff` (cyan)

### Change Code Length
- Min: 6 characters
- Max: 8 characters
- Set in admin.html when generating

### Bypass for Testing
Temporarily disable access control:
Comment out lines 932-935 in index.html:
```javascript
// if (sessionStorage.getItem('wh15p3r_access') !== 'granted') {
//   window.location.href = 'access.html';
// }
```
