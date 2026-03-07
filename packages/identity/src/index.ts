/**
 * Identity package — phone/email identity management, MFA enrollment + verification,
 * trusted devices, step-up challenges, recovery codes.
 */
export { createIdentityService, type IdentityService } from './identity-service.js';
export { createMfaService, type MfaService } from './mfa-service.js';
export { createStepUpService, type StepUpService } from './step-up-service.js';
export { createTrustedDeviceService, type TrustedDeviceService } from './trusted-device-service.js';
export { normalizePhone, normalizeEmail } from './normalize.js';
export { generateOtp, hashOtp, verifyOtpHash } from './otp.js';
export { generateTotpSecret, verifyTotp, generateTotpUri } from './totp.js';
export { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCodeHash } from './recovery-codes.js';
