import type { DateTimeString } from './common.js';
import type { UserRole } from './auth.js';

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, { before: unknown; after: unknown }> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: DateTimeString;
}
