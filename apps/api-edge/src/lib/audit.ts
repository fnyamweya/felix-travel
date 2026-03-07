import type { WebhooksRepository } from '@felix-travel/db';
import type { SessionContext } from '@felix-travel/types';

export async function writeAuditLog(
  repo: WebhooksRepository,
  session: SessionContext,
  action: string,
  entityType: string,
  entityId: string,
  changes?: Record<string, { before: unknown; after: unknown }>,
  ipAddress?: string
): Promise<void> {
  await repo.createAuditLog({
    id: crypto.randomUUID(),
    actorId: session.userId,
    actorRole: session.role,
    action,
    entityType,
    entityId,
    changes: changes ? JSON.stringify(changes) : null,
    ipAddress: ipAddress ?? null,
    userAgent: null,
  });
}
