import { eq, and, isNull, desc } from 'drizzle-orm';
import type { DbClient } from '../client.js';
import { users, profiles, sessions, invites, otpVerifications } from '../schema/index.js';

export class UsersRepository {
  constructor(private readonly db: DbClient) { }

  async findById(id: string) {
    return this.db.query.users.findFirst({
      where: and(eq(users.id, id), isNull(users.deletedAt)),
    });
  }

  async findByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: and(eq(users.email, email), isNull(users.deletedAt)),
    });
  }

  async create(data: typeof users.$inferInsert) {
    const [user] = await this.db.insert(users).values(data).returning();
    if (!user) throw new Error('User insert returned no rows');
    return user;
  }

  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    const [updated] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning();
    return updated ?? null;
  }

  async softDelete(id: string) {
    await this.db
      .update(users)
      .set({ deletedAt: new Date().toISOString(), isActive: false })
      .where(eq(users.id, id));
  }

  async createProfile(data: typeof profiles.$inferInsert) {
    const [profile] = await this.db.insert(profiles).values(data).returning();
    if (!profile) throw new Error('Profile insert returned no rows');
    return profile;
  }

  async updateProfile(userId: string, data: Partial<typeof profiles.$inferInsert>) {
    const [updated] = await this.db
      .update(profiles)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(profiles.userId, userId))
      .returning();
    return updated ?? null;
  }

  async createSession(data: typeof sessions.$inferInsert) {
    const [session] = await this.db.insert(sessions).values(data).returning();
    if (!session) throw new Error('Session insert returned no rows');
    return session;
  }

  async findSession(id: string) {
    return this.db.query.sessions.findFirst({
      where: and(eq(sessions.id, id), isNull(sessions.revokedAt)),
    });
  }

  async revokeSession(id: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(sessions.id, id));
  }

  async revokeAllUserSessions(userId: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async createOtp(data: typeof otpVerifications.$inferInsert) {
    const [otp] = await this.db.insert(otpVerifications).values(data).returning();
    if (!otp) throw new Error('OTP insert returned no rows');
    return otp;
  }

  async findActiveOtp(userId: string, purpose: string) {
    return this.db.query.otpVerifications.findFirst({
      where: and(
        eq(otpVerifications.userId, userId),
        eq(otpVerifications.purpose, purpose as 'phone_verification' | 'login' | 'payment_confirmation'),
        isNull(otpVerifications.usedAt)
      ),
      orderBy: [desc(otpVerifications.createdAt)],
    });
  }

  async markOtpUsed(id: string) {
    await this.db
      .update(otpVerifications)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(otpVerifications.id, id));
  }

  async createInvite(data: typeof invites.$inferInsert) {
    const [invite] = await this.db.insert(invites).values(data).returning();
    if (!invite) throw new Error('Invite insert returned no rows');
    return invite;
  }

  async findInviteByTokenHash(tokenHash: string) {
    return this.db.query.invites.findFirst({ where: eq(invites.tokenHash, tokenHash) });
  }

  async acceptInvite(id: string) {
    await this.db.update(invites).set({ acceptedAt: new Date().toISOString() }).where(eq(invites.id, id));
  }
}
