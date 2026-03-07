/**
 * Recovery code generation and verification.
 *
 * Recovery codes are single-use backup codes for when MFA devices are lost.
 * Each code is 8 alphanumeric characters, stored as SHA-256 hashes.
 */

const encoder = new TextEncoder();
const RECOVERY_CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // No confusable chars (0/o, 1/l/i)

/**
 * Generate n recovery codes (default 10). Returns plaintext codes that
 * should be displayed to the user once and never stored in plaintext.
 */
export function generateRecoveryCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        const bytes = crypto.getRandomValues(new Uint8Array(8));
        let code = '';
        for (const b of bytes) {
            code += RECOVERY_CODE_CHARS[b % RECOVERY_CODE_CHARS.length];
        }
        // Format as xxxx-xxxx for readability
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
}

/**
 * Hash a recovery code for storage.
 */
export async function hashRecoveryCode(code: string): Promise<string> {
    const normalized = code.replace(/-/g, '').toLowerCase();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized));
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Verify a recovery code against its stored hash. Constant-time comparison.
 */
export async function verifyRecoveryCodeHash(code: string, storedHash: string): Promise<boolean> {
    const computedHash = await hashRecoveryCode(code);
    if (computedHash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHash.length; i++) {
        diff |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return diff === 0;
}
