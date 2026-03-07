/**
 * Auth routes — /api/v1/auth
 *
 * Public:  POST /register, POST /login, POST /refresh, POST /magic-link/request,
 *          POST /magic-link/verify, POST /invite/accept
 * Authed:  POST /logout, POST /mfa/totp/enroll, POST /mfa/totp/confirm,
 *          POST /mfa/totp/verify, POST /mfa/sms/enroll, POST /mfa/sms/send,
 *          POST /mfa/sms/verify, POST /mfa/recovery, GET /mfa/methods,
 *          DELETE /mfa/:method, POST /mfa/recovery/regenerate,
 *          POST /step-up/challenge, POST /step-up/verify
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import type { MfaMethod } from '@felix-travel/types';
import { requireAuth, rateLimit } from '@felix-travel/auth';
import { createDbClient } from '@felix-travel/db';
import { createLogger } from '@felix-travel/telemetry';
import { AuthService } from '../../services/auth.service.js';
import { success, error } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import {
  registerSchema,
  loginSchema,
  magicLinkRequestSchema,
  refreshTokenSchema,
  inviteAcceptSchema,
} from '@felix-travel/validation';

type HonoEnv = {
  Bindings: Env;
  Variables: { session: SessionContext };
};

export const authRoutes = new Hono<HonoEnv>();

// ─── Helpers ─────────────────────────────────────────────────────

function getAuthService(c: { env: Env }) {
  return new AuthService(c.env.DB, c.env);
}

function hexToKey(hex: string): Uint8Array {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((h) => parseInt(h, 16)));
}

const logger = createLogger({ level: 'info', service: 'auth-routes' });

// ─── Public endpoints ────────────────────────────────────────────

authRoutes.post(
  '/register',
  rateLimit({ limit: 10, windowSeconds: 600 }),
  async (c) => {
    const body = await c.req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
    }
    const svc = getAuthService(c);
    const result = await svc.register({
      email: parsed.data.email,
      password: parsed.data.password,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
    });
    return c.json(success(result), 201);
  }
);

authRoutes.post(
  '/login',
  rateLimit({ limit: 20, windowSeconds: 300 }),
  async (c) => {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
    }
    const svc = getAuthService(c);
    const result = await svc.login(parsed.data.email, parsed.data.password);
    return c.json(success(result));
  }
);

authRoutes.post(
  '/refresh',
  rateLimit({ limit: 30, windowSeconds: 60 }),
  async (c) => {
    const body = await c.req.json();
    const parsed = refreshTokenSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
    }
    const svc = getAuthService(c);
    const tokens = await svc.refreshSession(parsed.data.refreshToken);
    return c.json(success(tokens));
  }
);

authRoutes.post(
  '/magic-link/request',
  rateLimit({ limit: 5, windowSeconds: 600 }),
  async (c) => {
    const body = await c.req.json();
    const parsed = magicLinkRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
    }
    const svc = getAuthService(c);
    await svc.requestMagicLink(parsed.data.email);
    return c.json(success({ message: 'If the email is registered, a login link has been sent' }));
  }
);

authRoutes.post(
  '/invite/accept',
  rateLimit({ limit: 10, windowSeconds: 600 }),
  async (c) => {
    const body = await c.req.json();
    const parsed = inviteAcceptSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', { issues: parsed.error.flatten().fieldErrors });
    }
    const svc = getAuthService(c);
    const result = await svc.acceptInvite(parsed.data);
    return c.json(success(result), 201);
  }
);

// ─── Authenticated endpoints ─────────────────────────────────────

authRoutes.post('/logout', requireAuth, async (c) => {
  const session = c.get('session');
  const svc = getAuthService(c);
  await svc.logout(session.sessionId);
  return c.json(success({ message: 'Logged out' }));
});

// ─── MFA — TOTP ─────────────────────────────────────────────────

authRoutes.post('/mfa/totp/enroll', requireAuth, async (c) => {
  const session = c.get('session');
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const result = await mfa.enrollTotp(session.userId, session.userId);
  return c.json(success(result));
});

authRoutes.post('/mfa/totp/confirm', requireAuth, async (c) => {
  const session = c.get('session');
  const { code } = await c.req.json<{ code: string }>();
  if (!code || code.length !== 6) throw new ValidationError('A 6-digit TOTP code is required');
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const result = await mfa.confirmTotpEnrollment(session.userId, code);
  return c.json(success(result));
});

authRoutes.post('/mfa/totp/verify', requireAuth, async (c) => {
  const session = c.get('session');
  const { code } = await c.req.json<{ code: string }>();
  if (!code || code.length !== 6) throw new ValidationError('A 6-digit TOTP code is required');
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const valid = await mfa.verifyTotpCode(session.userId, code);
  if (!valid) return c.json(error('INVALID_CODE', 'Invalid TOTP code'), 401);
  return c.json(success({ verified: true }));
});

// ─── MFA — SMS ──────────────────────────────────────────────────

authRoutes.post('/mfa/sms/enroll', requireAuth, async (c) => {
  const session = c.get('session');
  const { phoneNumber } = await c.req.json<{ phoneNumber: string }>();
  if (!phoneNumber) throw new ValidationError('phoneNumber is required');
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const result = await mfa.enrollSms(session.userId, phoneNumber);
  return c.json(success(result));
});

authRoutes.post('/mfa/sms/send', requireAuth, async (c) => {
  const session = c.get('session');
  const { createEngageSmsClient } = await import('@felix-travel/sdk-tingg/engage');
  const smsClient = createEngageSmsClient({
    username: c.env.TINGG_ENGAGE_USERNAME,
    password: c.env.TINGG_ENGAGE_PASSWORD,
    senderId: c.env.TINGG_ENGAGE_SENDER_ID,
    baseUrl: c.env.TINGG_ENGAGE_BASE_URL,
  });
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
    sendSms: async (phone: string, message: string) => {
      await smsClient.sendSms(phone, message);
    },
  });
  await mfa.sendSmsChallenge(session.userId);
  return c.json(success({ sent: true }));
});

authRoutes.post('/mfa/sms/verify', requireAuth, async (c) => {
  const session = c.get('session');
  const { code } = await c.req.json<{ code: string }>();
  if (!code) throw new ValidationError('code is required');
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const valid = await mfa.verifySmsCode(session.userId, code);
  if (!valid) return c.json(error('INVALID_CODE', 'Invalid SMS code'), 401);
  return c.json(success({ verified: true }));
});

// ─── MFA — Recovery codes ────────────────────────────────────────

authRoutes.post('/mfa/recovery', requireAuth, async (c) => {
  const session = c.get('session');
  const { code } = await c.req.json<{ code: string }>();
  if (!code) throw new ValidationError('code is required');
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const valid = await mfa.verifyRecoveryCode(session.userId, code);
  if (!valid) return c.json(error('INVALID_CODE', 'Invalid recovery code'), 401);
  return c.json(success({ verified: true }));
});

authRoutes.post('/mfa/recovery/regenerate', requireAuth, async (c) => {
  const session = c.get('session');
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const codes = await mfa.regenerateRecoveryCodes(session.userId);
  return c.json(success({ codes }));
});

// ─── MFA — List and disable ─────────────────────────────────────

authRoutes.get('/mfa/methods', requireAuth, async (c) => {
  const session = c.get('session');
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const methods = await mfa.getEnrolledMethods(session.userId);
  return c.json(success(methods));
});

authRoutes.delete('/mfa/:method', requireAuth, async (c) => {
  const session = c.get('session');
  const method = c.req.param('method') as MfaMethod;
  const { createMfaService } = await import('@felix-travel/identity');
  const mfa = createMfaService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  await mfa.disableFactor(session.userId, method);
  return c.json(success({ disabled: true }));
});

// ─── Step-up authentication ──────────────────────────────────────

authRoutes.post('/step-up/challenge', requireAuth, async (c) => {
  const session = c.get('session');
  const { method, actionContext } = await c.req.json<{ method: 'sms_otp' | 'totp'; actionContext?: Record<string, unknown> }>();
  if (!method) throw new ValidationError('method is required');
  const { createStepUpService } = await import('@felix-travel/identity');

  let sendSms: ((phone: string, message: string) => Promise<void>) | undefined;
  if (method === 'sms_otp') {
    const { createEngageSmsClient } = await import('@felix-travel/sdk-tingg/engage');
    const smsClient = createEngageSmsClient({
      username: c.env.TINGG_ENGAGE_USERNAME,
      password: c.env.TINGG_ENGAGE_PASSWORD,
      senderId: c.env.TINGG_ENGAGE_SENDER_ID,
      baseUrl: c.env.TINGG_ENGAGE_BASE_URL,
    });
    sendSms = async (phone: string, message: string) => {
      await smsClient.sendSms(phone, message);
    };
  }

  const stepUp = createStepUpService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
    ...(sendSms !== undefined && { sendSms }),
  });

  const challenge = await stepUp.createChallenge(
    session.userId,
    session.sessionId,
    method,
    'step_up',
    actionContext ?? {},
  );
  return c.json(success({ challengeId: challenge.challengeId, method: challenge.method }));
});

authRoutes.post('/step-up/verify', requireAuth, async (c) => {
  const session = c.get('session');
  const { challengeId, code } = await c.req.json<{ challengeId: string; code: string }>();
  if (!challengeId || !code) throw new ValidationError('challengeId and code are required');
  const { createStepUpService } = await import('@felix-travel/identity');
  const stepUp = createStepUpService({
    db: createDbClient(c.env.DB),
    logger,
    generateId: () => crypto.randomUUID(),
    totpEncryptionKey: hexToKey(c.env.MFA_ENCRYPTION_KEY),
  });
  const result = await stepUp.completeChallenge(challengeId, session.userId, code);
  return c.json(success(result));
});
