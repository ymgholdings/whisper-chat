#!/usr/bin/env -S deno run --allow-net --allow-env

// CLI tool to generate WH15P3R access codes
// Usage: deno run --allow-net --allow-env generate-code.ts [options]

const SERVER_URL = Deno.env.get('WHISPER_SERVER') || 'https://whisper-signaling-20.deno.dev';
const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || 'change-this-secret-in-production';

async function generateCode(maxUses: number = 1, expiresInHours: number | null = null) {
  try {
    const response = await fetch(`${SERVER_URL}/admin/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_SECRET}`
      },
      body: JSON.stringify({
        maxUses,
        expiresInHours
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error.error || 'Failed to generate code');
      Deno.exit(1);
    }

    const result = await response.json();

    console.log('\n✅ Access code generated successfully!\n');
    console.log(`   CODE: ${result.code}`);
    console.log(`   Max uses: ${result.maxUses}`);
    console.log(`   Expires: ${result.expiresAt || 'Never'}`);
    console.log(`\n   Share this code with your contact to grant access.`);
    console.log(`\n`);

  } catch (e) {
    console.error('❌ Failed to connect to server:', e.message);
    Deno.exit(1);
  }
}

async function listCodes() {
  try {
    const response = await fetch(`${SERVER_URL}/admin/codes`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error.error || 'Failed to list codes');
      Deno.exit(1);
    }

    const result = await response.json();

    console.log('\n📋 Active Access Codes:\n');

    if (result.codes.length === 0) {
      console.log('   No codes found.');
    } else {
      result.codes.forEach((code: any) => {
        const status = code.active ? '✓ Active' : '✗ Inactive';
        console.log(`   ${code.code} - ${status}`);
        console.log(`     Used: ${code.usedCount}/${code.maxUses}`);
        console.log(`     Created: ${code.created}`);
        if (code.expiresAt) {
          console.log(`     Expires: ${code.expiresAt}`);
        }
        console.log('');
      });
    }

  } catch (e) {
    console.error('❌ Failed to connect to server:', e.message);
    Deno.exit(1);
  }
}

async function deleteCode(code: string) {
  try {
    const response = await fetch(`${SERVER_URL}/admin/codes/${code}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${ADMIN_SECRET}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error.error || 'Failed to delete code');
      Deno.exit(1);
    }

    console.log(`\n✅ Code ${code} deleted successfully.\n`);

  } catch (e) {
    console.error('❌ Failed to connect to server:', e.message);
    Deno.exit(1);
  }
}

function showHelp() {
  console.log(`
WH15P3R Access Code Generator

Usage:
  deno run --allow-net --allow-env generate-code.ts [command] [options]

Commands:
  generate [options]  Generate a new access code (default command)
    --max-uses <n>      Maximum number of times code can be used (default: 1)
    --expires <hours>   Code expires after N hours (default: never)

  list                List all access codes

  delete <code>       Delete an access code

Environment Variables:
  WHISPER_SERVER      Server URL (default: https://whisper-signaling-20.ymgholdings.deno.net)
  ADMIN_SECRET        Admin secret key (default: change-this-secret-in-production)

Examples:
  # Generate single-use code
  deno run --allow-net --allow-env generate-code.ts

  # Generate code for 5 uses, expires in 24 hours
  deno run --allow-net --allow-env generate-code.ts generate --max-uses 5 --expires 24

  # List all codes
  deno run --allow-net --allow-env generate-code.ts list

  # Delete a code
  deno run --allow-net --allow-env generate-code.ts delete ABC12345
`);
}

// Parse command line arguments
const args = Deno.args;

if (args.length === 0 || args[0] === 'generate') {
  let maxUses = 1;
  let expiresInHours: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-uses' && args[i + 1]) {
      maxUses = parseInt(args[i + 1]);
    }
    if (args[i] === '--expires' && args[i + 1]) {
      expiresInHours = parseInt(args[i + 1]);
    }
  }

  await generateCode(maxUses, expiresInHours);

} else if (args[0] === 'list') {
  await listCodes();

} else if (args[0] === 'delete' && args[1]) {
  await deleteCode(args[1].toUpperCase());

} else if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  showHelp();

} else {
  console.error('Unknown command:', args[0]);
  console.log('Run with --help for usage information');
  Deno.exit(1);
}
