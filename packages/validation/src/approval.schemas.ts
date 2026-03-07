import { z } from 'zod';

// ─── Approval decision ──────────────────────────────────────────

export const approvalDecisionSchema = z.object({
    decision: z.enum(['approve', 'reject', 'abstain', 'escalate']),
    comment: z.string().max(1000).optional(),
});

// ─── Delegation ──────────────────────────────────────────────────

export const createDelegationSchema = z.object({
    delegateToUserId: z.string().min(1),
    actionCodes: z.string().min(1).default('*'),
    expiresAt: z.string().datetime(),
});

// ─── Policy evaluation (dry-run) ─────────────────────────────────

export const evaluatePolicySchema = z.object({
    actionCode: z.string().min(1),
    context: z.record(z.unknown()).default({}),
});
