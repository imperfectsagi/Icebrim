/**
 * Bootstrap the first admin user.
 *
 * Usage:
 *   node scripts/create-admin.mjs <username> <email> <password> [--local]
 *
 * This hashes the password using the exact same PBKDF2-SHA256 routine the
 * Worker verifies against (src/lib/password.ts), then prints the SQL
 * INSERT statement to run via wrangler. We generate SQL to run through
 * `wrangler d1 execute` rather than inserting directly, since this script
 * runs in plain Node (for convenient local use) while the actual
 * verification path runs in the Workers runtime -- printing SQL keeps
 * both paths using D1 as the single source of truth.
 */

import { webcrypto as crypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_BYTES * 8,
  );
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bufferToBase64(salt.buffer)}$${bufferToBase64(derivedBits)}`;
}

function randomId() {
  return `user_${crypto.randomUUID()}`;
}

async function main() {
  const [, , username, email, password, ...flags] = process.argv;
  const isLocal = flags.includes('--local');

  if (!username || !email || !password) {
    console.error('Usage: node scripts/create-admin.mjs <username> <email> <password> [--local]');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const id = randomId();

  // Parameterize via a temp SQL file passed to `--file`, rather than
  // building a shell command string. Passing the hash through a shell
  // string (even quoted) is unsafe here: PBKDF2 hashes contain `$`
  // delimiters, which a shell interprets as variable expansion inside
  // double-quoted strings, silently corrupting the stored hash. Writing
  // to a file and using execFileSync (no shell involved) sidesteps both
  // that correctness bug and the shell-injection risk of interpolating
  // user-supplied username/email into a command string at all.
  const escapedUsername = username.replace(/'/g, "''");
  const escapedEmail = email.replace(/'/g, "''");
  const sql = `INSERT INTO users (id, username, email, password_hash, role) VALUES ('${id}', '${escapedUsername}', '${escapedEmail}', '${passwordHash}', 'admin');\n`;

  const tempFile = join(tmpdir(), `create-admin-${crypto.randomUUID()}.sql`);
  writeFileSync(tempFile, sql, 'utf-8');

  console.log('Creating admin user via wrangler d1 execute...');
  const flag = isLocal ? '--local' : '--remote';
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'icebrim-db', flag, `--file=${tempFile}`], {
      stdio: 'inherit',
    });
  } finally {
    unlinkSync(tempFile);
  }

  console.log(`\nAdmin user "${username}" created successfully.`);
  console.log('You can now sign in at /admin/login with the password you provided.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
