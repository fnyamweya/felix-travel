/**
 * TOTP implementation — RFC 6238 / RFC 4226 compatible.
 * Uses Web Crypto API (Workers-compatible). No dependency on node:crypto.
 *
 * The TOTP secret is stored AES-256-GCM encrypted in the database.
 * This module handles secret generation, URI generation (for QR codes),
 * and TOTP verification with a configurable time-step window.
 */

const encoder = new TextEncoder();

/**
 * Generate a random 20-byte TOTP secret, returned as base32-encoded string.
 */
export function generateTotpSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    return base32Encode(bytes);
}

/**
 * Build the otpauth:// URI used by authenticator apps.
 */
export function generateTotpUri(
    secret: string,
    accountName: string,
    issuer: string,
    options?: { algorithm?: string; digits?: number; period?: number },
): string {
    const alg = options?.algorithm ?? 'SHA1';
    const digits = options?.digits ?? 6;
    const period = options?.period ?? 30;
    const label = encodeURIComponent(`${issuer}:${accountName}`);
    const params = new URLSearchParams({
        secret,
        issuer,
        algorithm: alg,
        digits: digits.toString(),
        period: period.toString(),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Verify a TOTP code against a secret. Allows a configurable number of
 * time-step windows before and after the current step (default: 1).
 */
export async function verifyTotp(
    code: string,
    secret: string,
    options?: { algorithm?: string; digits?: number; period?: number; window?: number },
): Promise<boolean> {
    const digits = options?.digits ?? 6;
    const period = options?.period ?? 30;
    const window = options?.window ?? 1;
    const algorithm = options?.algorithm ?? 'SHA1';

    const currentStep = Math.floor(Date.now() / 1000 / period);
    const secretBytes = base32Decode(secret);

    for (let offset = -window; offset <= window; offset++) {
        const step = currentStep + offset;
        const generated = await generateTotpCode(secretBytes, step, digits, algorithm);
        // Constant-time comparison
        if (constantTimeCompare(code, generated)) {
            return true;
        }
    }
    return false;
}

/**
 * Encrypt a TOTP secret using AES-256-GCM. Returns "iv_hex:ciphertext_hex".
 */
export async function encryptTotpSecret(plaintext: string, keyBytes: Uint8Array): Promise<string> {
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext),
    );
    const ivHex = bytesToHex(iv);
    const cipherHex = bytesToHex(new Uint8Array(cipherBuffer));
    return `${ivHex}:${cipherHex}`;
}

/**
 * Decrypt a TOTP secret stored in "iv_hex:ciphertext_hex" format.
 */
export async function decryptTotpSecret(encrypted: string, keyBytes: Uint8Array): Promise<string> {
    const [ivHex, cipherHex] = encrypted.split(':');
    if (!ivHex || !cipherHex) throw new Error('Invalid encrypted secret format');
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const iv = hexToBytes(ivHex);
    const cipherBytes = hexToBytes(cipherHex);
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
    return new TextDecoder().decode(plainBuffer);
}

// ──────────────────────────────────────────────
// Internal HMAC-based OTP generation (RFC 4226)
// ──────────────────────────────────────────────

async function generateTotpCode(
    secretBytes: Uint8Array,
    step: number,
    digits: number,
    algorithm: string,
): Promise<string> {
    const hmacAlg = algorithm === 'SHA1' ? 'SHA-1' : algorithm === 'SHA256' ? 'SHA-256' : 'SHA-512';
    const key = await crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: hmacAlg },
        false,
        ['sign'],
    );

    // Encode the step as a big-endian 8-byte integer
    const stepBuffer = new ArrayBuffer(8);
    const stepView = new DataView(stepBuffer);
    stepView.setUint32(0, Math.floor(step / 0x100000000));
    stepView.setUint32(4, step & 0xffffffff);

    const hmac = await crypto.subtle.sign('HMAC', key, stepBuffer);
    const hmacBytes = new Uint8Array(hmac);

    // Dynamic truncation per RFC 4226 §5.4
    const offset = (hmacBytes[hmacBytes.length - 1] ?? 0) & 0x0f;
    const binary =
        (((hmacBytes[offset] ?? 0) & 0x7f) << 24) |
        (((hmacBytes[offset + 1] ?? 0) & 0xff) << 16) |
        (((hmacBytes[offset + 2] ?? 0) & 0xff) << 8) |
        ((hmacBytes[offset + 3] ?? 0) & 0xff);

    const otp = binary % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
}

// ──────────────────────────────────────────────
// Base32 encoding/decoding (RFC 4648)
// ──────────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(data: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of data) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            bits -= 5;
            output += BASE32_ALPHABET[(value >>> bits) & 31];
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

function base32Decode(encoded: string): Uint8Array {
    const cleaned = encoded.toUpperCase().replace(/=+$/, '');
    const output: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of cleaned) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bits -= 8;
            output.push((value >>> bits) & 0xff);
        }
    }
    return new Uint8Array(output);
}

// ──────────────────────────────────────────────
// Hex utilities
// ──────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBytes(hex: string): Uint8Array {
    const pairs = hex.match(/.{2}/g);
    if (!pairs) throw new Error('Invalid hex string');
    return new Uint8Array(pairs.map((h) => parseInt(h, 16)));
}

function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
