/**
 * JWT utilities using the Web Crypto API (available in Cloudflare Workers).
 * Uses RS256 (RSA-SHA256) signing via SubtleCrypto — no Node.js crypto required.
 *
 * RS256 is chosen over HS256 because:
 * - The public key can be distributed to frontend apps for local verification
 * - Compromising a frontend asset does not expose the signing key
 */
import type { JwtPayload, UserRole } from '@felix-travel/types';

/** Base64url encode a buffer */
function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Base64url decode to ArrayBuffer */
function base64urlDecode(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(padLength);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Import RSA private key from PEM (base64-encoded) */
async function importPrivateKey(base64Pem: string): Promise<CryptoKey> {
  const pem = atob(base64Pem);
  const pemBody = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '');
  const der = base64urlDecode(pemBody.replace(/\+/g, '-').replace(/\//g, '_'));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/** Import RSA public key from PEM (base64-encoded) */
async function importPublicKey(base64Pem: string): Promise<CryptoKey> {
  const pem = atob(base64Pem);
  const pemBody = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '');
  const der = base64urlDecode(pemBody.replace(/\+/g, '-').replace(/\//g, '_'));
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

const encoder = new TextEncoder();

/** Sign a JWT payload using RS256 */
export async function signJwt(
  payload: JwtPayload,
  privateKeyBase64: string
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)).buffer as ArrayBuffer);
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)).buffer as ArrayBuffer);
  const signingInput = `${headerB64}.${payloadB64}`;
  const privateKey = await importPrivateKey(privateKeyBase64);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(signingInput)
  );
  return `${signingInput}.${base64urlEncode(signature)}`;
}

/** Verify and decode a JWT. Returns null if invalid/expired. */
export async function verifyJwt(
  token: string,
  publicKeyBase64: string,
  expectedIssuer: string,
  expectedAudience: string
): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  try {
    const publicKey = await importPublicKey(publicKeyBase64);
    const signingInput = `${headerB64}.${payloadB64}`;
    const signatureBytes = base64urlDecode(signatureB64);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBytes,
      encoder.encode(signingInput)
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;

    // Validate standard claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iss !== expectedIssuer) return null;
    if (payload.aud !== expectedAudience) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Build a JWT payload for a user session */
export function buildJwtPayload(opts: {
  userId: string;
  sessionId: string;
  role: UserRole;
  roles: string[];
  providerId: string | null;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  assuranceLevel?: number;
  mfaEnrolled?: boolean;
}): JwtPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: opts.userId,
    sid: opts.sessionId,
    role: opts.role,
    roles: opts.roles,
    pid: opts.providerId,
    sal: opts.assuranceLevel ?? 0,
    mfa: opts.mfaEnrolled ?? false,
    iss: opts.issuer,
    aud: opts.audience,
    iat: now,
    exp: now + opts.accessTtlSeconds,
  };
}
