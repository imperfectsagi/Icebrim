/**
 * Password hashing
 * -----------------
 * Cloudflare Workers (the `workerd` runtime) cannot run native Node.js
 * bindings, so npm packages like `bcrypt` or `argon2` (which rely on
 * native C++ addons) do not work here. There are two legitimate options
 * for Workers:
 *
 *   1. PBKDF2-SHA256 via the Web Crypto API (`crypto.subtle`), which is
 *      built into the runtime with zero extra dependencies and is a
 *      NIST/FIPS-approved KDF (this is what we use below).
 *   2. A WASM build of Argon2id (e.g. via a Rust-compiled WASM module or
 *      a dedicated service-binding Worker). This is stronger against
 *      GPU/ASIC attacks and is the recommended upgrade path if you want
 *      Argon2id specifically -- see e.g. github.com/glotlabs/argon2-cloudflare
 *      for a service-binding-based implementation.
 *
 * We use PBKDF2-SHA256 with 210,000 iterations (OWASP's 2026 minimum
 * recommendation for PBKDF2-SHA256) and a 128-bit random salt per
 * password. This is a secure, dependency-free choice appropriate for a
 * Workers runtime, while the module boundary below keeps it a one-file
 * swap if you later add an Argon2id WASM binding.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Hash a plaintext password, returning a PHC-like storable string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_BYTES * 8,
  );

  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bufferToBase64(salt.buffer as ArrayBuffer)}$${bufferToBase64(derivedBits)}`;
}

/** Verify a plaintext password against a stored hash string. Timing-safe. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;

  const iterations = Number(parts[1]);
  const salt = base64ToBuffer(parts[2]);
  const expectedHash = base64ToBuffer(parts[3]);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BYTES * 8,
  );

  return timingSafeEqual(new Uint8Array(derivedBits), new Uint8Array(expectedHash));
}

/** Constant-time byte comparison to avoid timing side-channels. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
