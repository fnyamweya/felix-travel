/**
 * HMAC signing utilities for webhook payload signatures.
 *
 * Each provider callback subscription has its own HMAC secret.
 * Signatures are computed over the full JSON payload body as a string,
 * with a timestamp prefix to prevent replay attacks:
 *   signature = HMAC-SHA256(secret, `${timestamp}.${body}`)
 *
 * The provider verifies by recomputing the HMAC with the shared secret.
 */

const encoder = new TextEncoder();

/** Sign a webhook payload. Returns hex-encoded HMAC-SHA256 signature. */
export async function signWebhookPayload(
  secret: string,
  timestamp: number,
  body: string,
  algo: 'SHA-256' | 'SHA-512' = 'SHA-256'
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: algo },
    false,
    ['sign']
  );
  const signingInput = `${timestamp}.${body}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Verify an inbound webhook signature (constant-time comparison) */
export async function verifyWebhookSignature(
  secret: string,
  timestamp: number,
  body: string,
  expectedSignature: string,
  algo: 'SHA-256' | 'SHA-512' = 'SHA-256'
): Promise<boolean> {
  const computed = await signWebhookPayload(secret, timestamp, body, algo);
  return constantTimeCompare(computed, expectedSignature);
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Sign internal event messages to prevent tampering of queue messages */
export async function signInternalEvent(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyInternalEvent(secret: string, payload: string, sig: string): Promise<boolean> {
  const computed = await signInternalEvent(secret, payload);
  return constantTimeCompare(computed, sig);
}
