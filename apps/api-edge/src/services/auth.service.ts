/**
 * AuthService — handles all authentication flows.
 *
 * Responsibilities:
 * - Register new users with password or magic link
 * - Login with email/password
 * - Issue and verify JWT token pairs
 * - Manage and refresh sessions
 * - Handle password reset and magic links
 * - Handle invites for agents and providers
 */
import { UsersRepository } from '@felix-travel/db';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
  signJwt,
  buildJwtPayload,
} from '@felix-travel/auth';
import type { Env } from '../bindings.js';
import type { TokenPair, AuthUser } from '@felix-travel/types';
import { createDbClient } from '@felix-travel/db';
import { AppError } from '../lib/errors.js';
import { newId } from '../lib/id.js';
import { parseEnv } from '@felix-travel/config';
import { verificationChallenges, profiles } from '@felix-travel/db';
import { eq, and, isNull } from 'drizzle-orm';

export class AuthService {
  private readonly repo: UsersRepository;
  private readonly env: ReturnType<typeof parseEnv>;
  private readonly db: ReturnType<typeof createDbClient>;

  constructor(db: D1Database, env: Env) {
    this.db = createDbClient(db);
    this.repo = new UsersRepository(this.db);
    this.env = parseEnv(env as unknown as Record<string, string>);
  }

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists', 409);
    }

    const passwordHash = await hashPassword(input.password);
    const userId = newId();

    const user = await this.repo.create({
      id: userId,
      email: input.email,
      passwordHash,
      role: 'customer',
      phone: input.phone ?? null,
    });

    await this.repo.createProfile({
      userId,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    const tokens = await this.issueTokenPair(user.id, user.role, null);
    return {
      user: this.toAuthUser(user),
      tokens,
    };
  }

  async login(email: string, password: string): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const user = await this.repo.findByEmail(email);
    // Always hash even if user not found to prevent timing-based email enumeration
    const dummyHash = 'pbkdf2:210000:00000000000000000000000000000000:00000000000000000000000000000000';
    const valid = user
      ? await verifyPassword(password, user.passwordHash ?? dummyHash)
      : await verifyPassword(password, dummyHash).then(() => false);

    if (!user || !valid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }
    if (!user.isActive) {
      throw new AppError('ACCOUNT_DISABLED', 'This account has been disabled', 403);
    }

    const tokens = await this.issueTokenPair(user.id, user.role, null);
    return { user: this.toAuthUser(user), tokens };
  }

  async refreshSession(sessionId: string): Promise<TokenPair> {
    const session = await this.repo.findSession(sessionId);
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found or revoked', 401);
    if (new Date(session.expiresAt) < new Date()) {
      await this.repo.revokeSession(sessionId);
      throw new AppError('SESSION_EXPIRED', 'Session has expired, please log in again', 401);
    }

    const user = await this.repo.findById(session.userId);
    if (!user || !user.isActive) {
      throw new AppError('USER_NOT_FOUND', 'User not found or disabled', 401);
    }

    // Rotate session: revoke old, issue new
    await this.repo.revokeSession(sessionId);
    return this.issueTokenPair(user.id, user.role, null);
  }

  async logout(sessionId: string): Promise<void> {
    await this.repo.revokeSession(sessionId);
  }

  async requestMagicLink(email: string): Promise<void> {
    // Always succeed even if email not found — prevents email enumeration
    const user = await this.repo.findByEmail(email);
    if (!user) return;
    const token = generateToken(32);
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + this.env.MAGIC_LINK_TTL_MINUTES * 60 * 1000).toISOString();
    await this.repo.createInvite({
      id: newId(),
      email,
      role: 'agent', // reuse invite table for magic links with special role marker
      invitedById: user.id,
      tokenHash,
      expiresAt,
    });
    // In production: queue email delivery via NOTIFICATION_QUEUE
    // The token is returned here only for dev convenience; in prod it's sent by email only
  }

  async createInvite(input: {
    email: string;
    role: 'agent' | 'service_provider';
    providerId?: string;
    invitedById: string;
  }): Promise<{ token: string }> {
    const token = generateToken(32);
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    await this.repo.createInvite({
      id: newId(),
      email: input.email,
      role: input.role,
      providerId: input.providerId ?? null,
      invitedById: input.invitedById,
      tokenHash,
      expiresAt,
    });
    return { token };
  }

  async acceptInvite(input: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const tokenHash = await hashToken(input.token);
    const invite = await this.repo.findInviteByTokenHash(tokenHash);
    if (!invite || invite.acceptedAt) {
      throw new AppError('INVALID_INVITE', 'Invite not found or already used', 400);
    }
    if (new Date(invite.expiresAt) < new Date()) {
      throw new AppError('INVITE_EXPIRED', 'Invite has expired', 400);
    }

    const passwordHash = await hashPassword(input.password);
    const userId = newId();

    const user = await this.repo.create({
      id: userId,
      email: invite.email,
      passwordHash,
      role: invite.role as 'agent' | 'service_provider',
    });

    await this.repo.createProfile({ userId, firstName: input.firstName, lastName: input.lastName });
    await this.repo.acceptInvite(invite.id);

    const tokens = await this.issueTokenPair(user.id, user.role, invite.providerId ?? null);
    return { user: this.toAuthUser(user), tokens };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.repo.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError('USER_NOT_FOUND', 'User not found or disabled', 404);
    }
    const profile = await this.db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    });
    return this.toAuthUser({ ...user, firstName: profile?.firstName ?? '', lastName: profile?.lastName ?? '' });
  }

  async requestPasswordReset(email: string): Promise<void> {
    // Always succeed to prevent email enumeration
    const user = await this.repo.findByEmail(email);
    if (!user) return;
    const token = generateToken(32);
    const secretHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    await this.db.insert(verificationChallenges).values({
      id: newId(),
      userId: user.id,
      purpose: 'password_reset',
      secretHash,
      expiresAt,
    });
    // TODO: queue email via NOTIFICATION_QUEUE with the reset link containing `token`
    // For now the token is only available server-side
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const secretHash = await hashToken(token);
    const challenge = await this.db.query.verificationChallenges.findFirst({
      where: and(
        eq(verificationChallenges.secretHash, secretHash),
        eq(verificationChallenges.purpose, 'password_reset'),
        isNull(verificationChallenges.usedAt),
      ),
    });
    if (!challenge) {
      throw new AppError('INVALID_TOKEN', 'Reset token is invalid or has already been used', 400);
    }
    if (new Date(challenge.expiresAt) < new Date()) {
      throw new AppError('TOKEN_EXPIRED', 'Reset token has expired', 400);
    }
    const passwordHash = await hashPassword(newPassword);
    await this.repo.update(challenge.userId, { passwordHash });
    // Mark challenge as used
    await this.db
      .update(verificationChallenges)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(verificationChallenges.id, challenge.id));
    // Revoke all sessions so user must re-login with new password
    await this.repo.revokeAllUserSessions(challenge.userId);
  }

  private async issueTokenPair(
    userId: string,
    role: string,
    providerId: string | null
  ): Promise<TokenPair> {
    const sessionId = newId();
    const refreshToken = generateToken(48);
    const refreshTokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.env.JWT_REFRESH_TTL_SECONDS * 1000
    ).toISOString();

    await this.repo.createSession({
      id: sessionId,
      userId,
      refreshTokenHash,
      expiresAt,
    });

    const payload = buildJwtPayload({
      userId,
      sessionId,
      role: role as Parameters<typeof buildJwtPayload>[0]['role'],
      roles: [role],
      providerId,
      issuer: this.env.JWT_ISSUER,
      audience: this.env.JWT_AUDIENCE,
      accessTtlSeconds: this.env.JWT_ACCESS_TTL_SECONDS,
    });

    const accessToken = await signJwt(payload, this.env.JWT_PRIVATE_KEY);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      tokenType: 'Bearer',
    };
  }

  private toAuthUser(user: { id: string; email: string; role: string; emailVerified: boolean; createdAt: string; phone?: string | null; firstName?: string; lastName?: string }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      role: user.role as AuthUser['role'],
      providerId: null,
      emailVerified: user.emailVerified,
      phone: user.phone ?? null,
      phoneVerified: false,
      mfaEnrolled: false,
      createdAt: user.createdAt,
    };
  }
}
