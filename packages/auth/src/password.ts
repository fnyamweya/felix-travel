/**
 * Password hashing using PBKDF2 via Web Crypto API (Workers-compatible).
 * bcrypt is not available on Workers — PBKDF2 with SHA-256 and 210,000 iterations
 * meets NIST SP 800-132 recommendations and exceeds OWASP minimums.
 *
 * Hash format: "pbkdf2:iterations:salt_hex:hash_hex"
 */

const encoder = new TextEncoder();

export async function hashPassword(password: string, iterations = 210000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const [, iterStr, saltHex, expectedHashHex] = parts;
  const iterations = parseInt(iterStr ?? '210000', 10);
  const saltBytes = new Uint8Array(saltHex?.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    keyMaterial,
    256
  );
  const computedHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  // Constant-time comparison to prevent timing attacks
  return constantTimeCompare(computedHex, expectedHashHex ?? '');
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
