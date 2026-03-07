/**
 * Normalization utilities for email and phone identifiers.
 *
 * Email: lowercased, trimmed.
 * Phone: normalized to E.164 with optional default country code.
 */

/**
 * Normalize an email address to lowercase. Removes leading/trailing whitespace.
 * Does NOT perform sub-addressing normalization (user+tag) because that is
 * provider-specific and could block legitimate addresses.
 */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

/**
 * Normalize a phone number to E.164 format.
 *
 * Handles:
 * - Already E.164: "+254712345678" → "+254712345678"
 * - Local with defaultCountry "KE": "0712345678" → "+254712345678"
 * - With spaces/dashes: "+254 712-345-678" → "+254712345678"
 *
 * Throws if the number cannot be parsed into a plausible E.164 format.
 */
export function normalizePhone(phone: string, defaultCountryCode?: string): string {
    // Strip all non-digit characters except leading +
    const stripped = phone.replace(/(?!^\+)\D/g, '');

    if (stripped.startsWith('+')) {
        // Already has country code
        if (stripped.length < 8 || stripped.length > 16) {
            throw new Error(`Invalid phone number length: ${stripped}`);
        }
        return stripped;
    }

    // Country code prefixes for local number conversion
    const COUNTRY_DIAL_CODES: Record<string, string> = {
        KE: '+254',
        UG: '+256',
        TZ: '+255',
        NG: '+234',
        GH: '+233',
        ZA: '+27',
    };

    // If starts with 0 and we have a default country, replace leading 0
    if (stripped.startsWith('0') && defaultCountryCode) {
        const prefix = COUNTRY_DIAL_CODES[defaultCountryCode.toUpperCase()];
        if (!prefix) {
            throw new Error(`Unsupported country code: ${defaultCountryCode}`);
        }
        const withoutLeadingZero = stripped.slice(1);
        const normalized = prefix + withoutLeadingZero;
        if (normalized.length < 8 || normalized.length > 16) {
            throw new Error(`Invalid phone number length after normalization: ${normalized}`);
        }
        return normalized;
    }

    // No leading + and no leading 0, try prepending + in case digits include country code
    const withPlus = '+' + stripped;
    if (withPlus.length < 8 || withPlus.length > 16) {
        throw new Error(`Cannot normalize phone number: ${phone}`);
    }
    return withPlus;
}
