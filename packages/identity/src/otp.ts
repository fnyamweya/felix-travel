/**
 * OTP generation and hashing — uses Web Crypto API (Workers-compatible).
 *
 * OTPs are 6-digit numeric codes. The plaintext code is sent to the user;
 * only the SHA-256 hash is persisted, mirroring password storage discipline.
 */

const encoder = new TextEncoder();

/**
 * Generate a cryptographically random 6-digit OTP.
 */
export function generateOtp(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const view = new DataView(bytes.buffer);
    // mod 1M gives a 0-999999 range; pad with leading zeros
    const numeric = view.getUint32(0) % 1_000_000;
    return numeric.toString().padStart(6, '0');
}

/**
 * Hash an OTP using SHA-256. The resulting hex digest is stored in the DB.
 */
export async function hashOtp(otp: string): Promise<string> {
    const data = encoder.encode(otp);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Verify an OTP against its stored hash. Constant-time comparison.
 */
export async function verifyOtpHash(otp: string, storedHash: string): Promise<boolean> {
    const computedHash = await hashOtp(otp);
    if (computedHash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHash.length; i++) {
        diff |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return diff === 0;
}
