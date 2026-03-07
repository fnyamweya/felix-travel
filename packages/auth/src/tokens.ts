/**
 * Token generation for magic links, password resets, and invites.
 * All tokens are cryptographically random and stored as SHA-256 hashes.
 */

/** Generate a cryptographically secure URL-safe random token */
export function generateToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a 6-digit numeric OTP */
export function generateOtp(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = new DataView(bytes.buffer).getUint32(0);
  return (num % 1000000).toString().padStart(6, '0');
}

/** Hash a token for storage using SHA-256 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
