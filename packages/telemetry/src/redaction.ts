/**
 * PII and secret redaction for logs and traces.
 *
 * Default patterns target common sensitive fields in the travel/payments domain:
 * - passwords, tokens, secrets, keys
 * - phone numbers (MSISDN), credit card numbers
 * - Tingg credentials and account identifiers
 *
 * Custom patterns can be added via RedactionConfig.
 */

export interface RedactionConfig {
    /** Additional field names to redact (case-insensitive match) */
    additionalFields?: string[];
    /** Replacement string for redacted values */
    replacement?: string;
}

const DEFAULT_REDACTED_FIELDS = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'newpassword',
    'currentpassword',
    'access_token',
    'accesstoken',
    'refresh_token',
    'refreshtoken',
    'refreshtokenhash',
    'token',
    'tokenhash',
    'secret',
    'secrethash',
    'client_secret',
    'clientsecret',
    'api_key',
    'apikey',
    'resend_api_key',
    'authorization',
    'cookie',
    'msisdn',
    'phone',
    'phonenumber',
    'phone_number',
    'creditpartyidentifier',
    'credit_party_identifier',
    'accountnumber',
    'account_number',
    'encryption_key',
    'encryptionkey',
    'csrf_secret',
    'csrfsecret',
    'jwt_private_key',
    'jwt_public_key',
    'internal_event_signing_secret',
    'otp',
    'code',
    'recovery_code',
    'totp_secret',
    'mfa_secret',
]);

const DEFAULT_REPLACEMENT = '[REDACTED]';

/**
 * Deep-redact sensitive fields from an object for safe logging.
 * Returns a new object with sensitive values replaced.
 */
export function redact(
    obj: unknown,
    config?: RedactionConfig
): unknown {
    const replacement = config?.replacement ?? DEFAULT_REPLACEMENT;
    const extraFields = new Set(
        (config?.additionalFields ?? []).map((f) => f.toLowerCase())
    );

    return redactInner(obj, replacement, extraFields, 0);
}

function redactInner(
    value: unknown,
    replacement: string,
    extraFields: Set<string>,
    depth: number
): unknown {
    // Prevent stack overflow on deeply nested structures
    if (depth > 20) return replacement;

    if (value === null || value === undefined) return value;

    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;

    if (Array.isArray(value)) {
        return value.map((item) => redactInner(item, replacement, extraFields, depth + 1));
    }

    if (typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            const keyLower = key.toLowerCase();
            if (DEFAULT_REDACTED_FIELDS.has(keyLower) || extraFields.has(keyLower)) {
                result[key] = replacement;
            } else {
                result[key] = redactInner(val, replacement, extraFields, depth + 1);
            }
        }
        return result;
    }

    return value;
}
