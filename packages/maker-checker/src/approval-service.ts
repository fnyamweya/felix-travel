/**
 * Approval service — manages the full lifecycle of approval requests.
 *
 * Core operations:
 * - createRequest: freeze workflow snapshot, create request + steps + candidates
 * - submitDecision: record a decision, advance the workflow accordingly
 * - getRequest: retrieve request with current status and decisions
 * - listPendingForUser: find requests where the user is an eligible candidate
 * - cancelRequest: cancel a pending request
 * - expireStaleRequests: cron job to expire timed-out requests
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import {
    approvalRequests,
    approvalRequestSteps,
    approvalRequestCandidates,
    approvalDecisions,
    approvalEventLog,
    approvalDelegations,
} from '@felix-travel/db/schema';
import type { Logger } from '@felix-travel/telemetry';
import type {
    ActionEnvelope,
    PolicyEvaluationResult,
    ApprovalRequestStatus,
    ApprovalDecisionType,
} from '@felix-travel/types';
import { compileWorkflow, type CompiledWorkflow } from '@felix-travel/policy-engine';
import { resolveCandidates } from '@felix-travel/policy-engine';

export interface ApprovalServiceDeps {
    db: DrizzleD1Database<Record<string, unknown>>;
    logger: Logger;
    generateId: () => string;
    /** Callback when an approval request is fully approved (execute the original action) */
    onApproved?: (requestId: string, envelope: ActionEnvelope) => Promise<void>;
    /** Callback when an approval request is rejected */
    onRejected?: (requestId: string, envelope: ActionEnvelope) => Promise<void>;
    /** Callback to notify candidates */
    onCandidatesNotified?: (userIds: string[], requestId: string) => Promise<void>;
}

export interface ApprovalService {
    createRequest(
        envelope: ActionEnvelope,
        policyResult: PolicyEvaluationResult,
        riskSnapshot?: Record<string, unknown>,
    ): Promise<{ requestId: string }>;

    submitDecision(
        requestId: string,
        deciderId: string,
        decision: ApprovalDecisionType,
        reason: string | null,
        sessionAssuranceLevel: number,
    ): Promise<{ requestStatus: ApprovalRequestStatus }>;

    getRequest(requestId: string): Promise<{
        request: Record<string, unknown>;
        steps: Array<Record<string, unknown>>;
        decisions: Array<Record<string, unknown>>;
    } | null>;

    listPendingForUser(userId: string): Promise<Array<Record<string, unknown>>>;

    cancelRequest(requestId: string, cancelledBy: string): Promise<void>;

    expireStaleRequests(): Promise<number>;
}

export function createApprovalService(deps: ApprovalServiceDeps): ApprovalService {
    const { db, logger, generateId } = deps;
    const candidateResolver = resolveCandidates(db);

    function nowIso(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    return {
        async createRequest(envelope, policyResult, riskSnapshot) {
            if (!policyResult.workflowTemplateId || !policyResult.policyVersionId) {
                throw new Error('Policy evaluation did not yield a workflow template');
            }

            // Compile workflow snapshot
            const compiled = await compileWorkflow(db, policyResult.workflowTemplateId);
            const requestId = generateId();
            const now = nowIso();

            // Create the request
            await db.insert(approvalRequests).values({
                id: requestId,
                actionId: envelope.actionType,
                policyVersionId: policyResult.policyVersionId,
                workflowTemplateId: policyResult.workflowTemplateId,
                workflowSnapshot: JSON.stringify(compiled),
                requestedBy: envelope.actor.userId,
                resourceType: envelope.resourceType,
                resourceId: envelope.resourceId,
                status: 'pending',
                actionEnvelope: JSON.stringify(envelope),
                riskSnapshot: riskSnapshot ? JSON.stringify(riskSnapshot) : null,
                currentStepOrder: 1,
                createdAt: now,
                updatedAt: now,
            });

            // Create request steps and resolve candidates for each
            for (const step of compiled.steps) {
                const requestStepId = generateId();
                const isFirst = step.stepOrder === 1;

                await db.insert(approvalRequestSteps).values({
                    id: requestStepId,
                    requestId,
                    stepId: step.stepId,
                    stepOrder: step.stepOrder,
                    status: isFirst ? 'in_progress' : 'pending',
                    startedAt: isFirst ? now : null,
                });

                // Resolve candidates for this step
                const candidates = await candidateResolver.resolve(
                    step.candidateRules,
                    [envelope.actor.userId], // exclude requestor
                    envelope.providerScope,
                );

                // For random/weighted modes, select the appropriate subset
                const selectedIds = selectCandidates(
                    candidates,
                    step.candidateSelectionMode,
                    step.quorumCount,
                    compiled,
                );

                for (const candidate of candidates) {
                    await db.insert(approvalRequestCandidates).values({
                        id: generateId(),
                        requestStepId,
                        userId: candidate.userId,
                        isSelected: selectedIds.has(candidate.userId),
                    });
                }

                // Notify selected candidates for the first step
                if (isFirst && deps.onCandidatesNotified) {
                    const notifyIds = candidates
                        .filter((c) => selectedIds.has(c.userId))
                        .map((c) => c.userId);
                    if (notifyIds.length > 0) {
                        await deps.onCandidatesNotified(notifyIds, requestId);
                    }
                }
            }

            // Log event
            await db.insert(approvalEventLog).values({
                id: generateId(),
                requestId,
                eventType: 'request_created',
                actorId: envelope.actor.userId,
                details: JSON.stringify({ policyVersionId: policyResult.policyVersionId }),
                createdAt: now,
            });

            logger.info('approval request created', {
                requestId,
                actionType: envelope.actionType,
                stepsCount: compiled.steps.length,
            });

            return { requestId };
        },

        async submitDecision(requestId, deciderId, decision, reason, sessionAssuranceLevel) {
            const now = nowIso();

            // Get the request
            const reqRows = await db
                .select()
                .from(approvalRequests)
                .where(eq(approvalRequests.id, requestId))
                .limit(1);

            if (reqRows.length === 0) throw new Error('Approval request not found');
            const request = reqRows[0]!;

            if (request.status !== 'pending' && request.status !== 'in_progress') {
                throw new Error(`Cannot submit decision on request in status: ${request.status}`);
            }

            // Check delegation eligibility
            const isEligible = await isDeciderEligible(db, requestId, deciderId, request.currentStepOrder);
            if (!isEligible) {
                throw new Error('User is not an eligible approver for the current step');
            }

            // Get current step
            const stepRows = await db
                .select()
                .from(approvalRequestSteps)
                .where(
                    and(
                        eq(approvalRequestSteps.requestId, requestId),
                        eq(approvalRequestSteps.stepOrder, request.currentStepOrder),
                    ),
                )
                .limit(1);

            if (stepRows.length === 0) throw new Error('Current step not found');
            const currentStep = stepRows[0]!;

            // Record decision
            await db.insert(approvalDecisions).values({
                id: generateId(),
                requestId,
                stepId: currentStep.stepId,
                decidedBy: deciderId,
                decision,
                reason,
                sessionAssuranceLevel,
                createdAt: now,
            });

            await db.insert(approvalEventLog).values({
                id: generateId(),
                requestId,
                eventType: 'decision_recorded',
                actorId: deciderId,
                details: JSON.stringify({ decision, stepOrder: request.currentStepOrder }),
                createdAt: now,
            });

            // Determine outcome based on decision type
            let requestStatus: ApprovalRequestStatus = request.status as ApprovalRequestStatus;

            if (decision === 'reject') {
                // Rejection terminates the workflow
                requestStatus = 'rejected';
                await db
                    .update(approvalRequests)
                    .set({ status: 'rejected', completedAt: now, updatedAt: now })
                    .where(eq(approvalRequests.id, requestId));

                await db
                    .update(approvalRequestSteps)
                    .set({ status: 'completed', completedAt: now })
                    .where(eq(approvalRequestSteps.id, currentStep.id));

                if (deps.onRejected) {
                    const envelope = JSON.parse(request.actionEnvelope) as ActionEnvelope;
                    await deps.onRejected(requestId, envelope);
                }
            } else if (decision === 'approve') {
                // Check if this step's quorum/completion criteria is met
                const workflow = JSON.parse(request.workflowSnapshot) as CompiledWorkflow;
                const compiledStep = workflow.steps.find((s) => s.stepOrder === request.currentStepOrder);

                const approvalCount = await db
                    .select({ cnt: sql<number>`count(*)` })
                    .from(approvalDecisions)
                    .where(
                        and(
                            eq(approvalDecisions.requestId, requestId),
                            eq(approvalDecisions.stepId, currentStep.stepId),
                            eq(approvalDecisions.decision, 'approve'),
                        ),
                    );

                const totalApprovals = approvalCount[0]?.cnt ?? 0;
                const quorumNeeded = compiledStep?.quorumCount ?? 1;

                if (totalApprovals >= quorumNeeded) {
                    // Step is complete — advance to next step or complete the request
                    await db
                        .update(approvalRequestSteps)
                        .set({ status: 'completed', completedAt: now })
                        .where(eq(approvalRequestSteps.id, currentStep.id));

                    const nextStepOrder = request.currentStepOrder + 1;
                    const nextStep = workflow.steps.find((s) => s.stepOrder === nextStepOrder);

                    if (nextStep) {
                        // Advance to next step
                        await db
                            .update(approvalRequests)
                            .set({ currentStepOrder: nextStepOrder, status: 'in_progress', updatedAt: now })
                            .where(eq(approvalRequests.id, requestId));

                        await db
                            .update(approvalRequestSteps)
                            .set({ status: 'in_progress', startedAt: now })
                            .where(
                                and(
                                    eq(approvalRequestSteps.requestId, requestId),
                                    eq(approvalRequestSteps.stepOrder, nextStepOrder),
                                ),
                            );

                        requestStatus = 'in_progress';

                        // Notify next step's candidates
                        if (deps.onCandidatesNotified) {
                            const nextStepRows = await db
                                .select({ id: approvalRequestSteps.id })
                                .from(approvalRequestSteps)
                                .where(
                                    and(
                                        eq(approvalRequestSteps.requestId, requestId),
                                        eq(approvalRequestSteps.stepOrder, nextStepOrder),
                                    ),
                                )
                                .limit(1);

                            if (nextStepRows.length > 0) {
                                const candidateRows = await db
                                    .select({ userId: approvalRequestCandidates.userId })
                                    .from(approvalRequestCandidates)
                                    .where(
                                        and(
                                            eq(approvalRequestCandidates.requestStepId, nextStepRows[0]!.id),
                                            eq(approvalRequestCandidates.isSelected, true),
                                        ),
                                    );
                                const notifyIds = candidateRows.map((c) => c.userId);
                                if (notifyIds.length > 0) {
                                    await deps.onCandidatesNotified(notifyIds, requestId);
                                }
                            }
                        }
                    } else {
                        // All steps complete — request is approved
                        requestStatus = 'approved';
                        await db
                            .update(approvalRequests)
                            .set({ status: 'approved', completedAt: now, updatedAt: now })
                            .where(eq(approvalRequests.id, requestId));

                        if (deps.onApproved) {
                            const envelope = JSON.parse(request.actionEnvelope) as ActionEnvelope;
                            await deps.onApproved(requestId, envelope);
                        }
                    }
                } else {
                    // Still waiting for more approvals
                    requestStatus = 'in_progress';
                    await db
                        .update(approvalRequests)
                        .set({ status: 'in_progress', updatedAt: now })
                        .where(eq(approvalRequests.id, requestId));
                }
            } else if (decision === 'escalate') {
                // Escalation advances to the next configured escalation step
                requestStatus = 'in_progress';
                await db
                    .update(approvalRequestSteps)
                    .set({ status: 'escalated', completedAt: now })
                    .where(eq(approvalRequestSteps.id, currentStep.id));

                const workflow = JSON.parse(request.workflowSnapshot) as CompiledWorkflow;
                const compiledStep = workflow.steps.find((s) => s.stepOrder === request.currentStepOrder);
                const escalation = compiledStep?.escalations[0];

                if (escalation?.escalateToStepId) {
                    const targetStep = workflow.steps.find((s) => s.stepId === escalation.escalateToStepId);
                    if (targetStep) {
                        await db
                            .update(approvalRequests)
                            .set({ currentStepOrder: targetStep.stepOrder, updatedAt: now })
                            .where(eq(approvalRequests.id, requestId));
                    }
                }
            }
            // 'abstain' — no state change, just records the abstention

            logger.info('approval decision submitted', {
                requestId,
                deciderId,
                decision,
                resultStatus: requestStatus,
            });

            return { requestStatus };
        },

        async getRequest(requestId) {
            const reqRows = await db
                .select()
                .from(approvalRequests)
                .where(eq(approvalRequests.id, requestId))
                .limit(1);

            if (reqRows.length === 0) return null;

            const stepRows = await db
                .select()
                .from(approvalRequestSteps)
                .where(eq(approvalRequestSteps.requestId, requestId))
                .orderBy(approvalRequestSteps.stepOrder);

            const decisionRows = await db
                .select()
                .from(approvalDecisions)
                .where(eq(approvalDecisions.requestId, requestId))
                .orderBy(approvalDecisions.createdAt);

            return {
                request: reqRows[0]! as Record<string, unknown>,
                steps: stepRows as Array<Record<string, unknown>>,
                decisions: decisionRows as Array<Record<string, unknown>>,
            };
        },

        async listPendingForUser(userId) {
            // Find request steps where the user is a selected candidate
            // and the step is in_progress
            const rows = await db
                .select({
                    requestId: approvalRequests.id,
                    actionEnvelope: approvalRequests.actionEnvelope,
                    resourceType: approvalRequests.resourceType,
                    resourceId: approvalRequests.resourceId,
                    currentStepOrder: approvalRequests.currentStepOrder,
                    createdAt: approvalRequests.createdAt,
                })
                .from(approvalRequestCandidates)
                .innerJoin(
                    approvalRequestSteps,
                    eq(approvalRequestSteps.id, approvalRequestCandidates.requestStepId),
                )
                .innerJoin(
                    approvalRequests,
                    eq(approvalRequests.id, approvalRequestSteps.requestId),
                )
                .where(
                    and(
                        eq(approvalRequestCandidates.userId, userId),
                        eq(approvalRequestCandidates.isSelected, true),
                        eq(approvalRequestSteps.status, 'in_progress'),
                        sql`${approvalRequests.status} in ('pending', 'in_progress')`,
                    ),
                );

            // Also check delegations to this user
            const delegationRows = await db
                .select()
                .from(approvalDelegations)
                .where(
                    and(
                        eq(approvalDelegations.delegateId, userId),
                        sql`${approvalDelegations.revokedAt} is null`,
                        sql`${approvalDelegations.expiresAt} > datetime('now')`,
                    ),
                );

            // If user has active delegations, also find pending requests for delegators
            if (delegationRows.length > 0) {
                for (const deleg of delegationRows) {
                    const delegatorPending = await db
                        .select({
                            requestId: approvalRequests.id,
                            actionEnvelope: approvalRequests.actionEnvelope,
                            resourceType: approvalRequests.resourceType,
                            resourceId: approvalRequests.resourceId,
                            currentStepOrder: approvalRequests.currentStepOrder,
                            createdAt: approvalRequests.createdAt,
                        })
                        .from(approvalRequestCandidates)
                        .innerJoin(
                            approvalRequestSteps,
                            eq(approvalRequestSteps.id, approvalRequestCandidates.requestStepId),
                        )
                        .innerJoin(
                            approvalRequests,
                            eq(approvalRequests.id, approvalRequestSteps.requestId),
                        )
                        .where(
                            and(
                                eq(approvalRequestCandidates.userId, deleg.delegatorId),
                                eq(approvalRequestCandidates.isSelected, true),
                                eq(approvalRequestSteps.status, 'in_progress'),
                                sql`${approvalRequests.status} in ('pending', 'in_progress')`,
                            ),
                        );

                    // Filter by delegation scope
                    for (const pending of delegatorPending) {
                        if (deleg.scope === '*' || deleg.scope.split(',').some((s) => {
                            const envelope = JSON.parse(pending.actionEnvelope) as ActionEnvelope;
                            return envelope.actionType === s.trim();
                        })) {
                            rows.push(pending);
                        }
                    }
                }
            }

            return rows as Array<Record<string, unknown>>;
        },

        async cancelRequest(requestId, cancelledBy) {
            const now = nowIso();
            await db
                .update(approvalRequests)
                .set({ status: 'cancelled', completedAt: now, updatedAt: now })
                .where(
                    and(
                        eq(approvalRequests.id, requestId),
                        sql`${approvalRequests.status} in ('pending', 'in_progress')`,
                    ),
                );

            await db.insert(approvalEventLog).values({
                id: generateId(),
                requestId,
                eventType: 'request_cancelled',
                actorId: cancelledBy,
                createdAt: now,
            });

            logger.info('approval request cancelled', { requestId, cancelledBy });
        },

        async expireStaleRequests() {
            const now = nowIso();
            const result = await db
                .update(approvalRequests)
                .set({ status: 'expired', completedAt: now, updatedAt: now })
                .where(
                    and(
                        sql`${approvalRequests.status} in ('pending', 'in_progress')`,
                        sql`${approvalRequests.expiresAt} is not null`,
                        sql`${approvalRequests.expiresAt} < ${now}`,
                    ),
                );

            const count = result.meta.changes ?? 0;
            if (count > 0) {
                logger.info('expired stale approval requests', { count });
            }
            return count;
        },
    };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function selectCandidates(
    candidates: Array<{ userId: string; weight: number }>,
    mode: string,
    quorumCount: number | null,
    _workflow: CompiledWorkflow,
): Set<string> {
    switch (mode) {
        case 'all':
            return new Set(candidates.map((c) => c.userId));

        case 'any':
            return new Set(candidates.map((c) => c.userId));

        case 'quorum':
            return new Set(candidates.map((c) => c.userId));

        case 'random': {
            if (candidates.length === 0) return new Set();
            const count = quorumCount ?? 1;
            const shuffled = [...candidates].sort(() => Math.random() - 0.5);
            return new Set(shuffled.slice(0, count).map((c) => c.userId));
        }

        case 'weighted_random': {
            if (candidates.length === 0) return new Set();
            const count = quorumCount ?? 1;
            const selected = new Set<string>();
            const pool = [...candidates];

            while (selected.size < count && pool.length > 0) {
                const totalWeight = pool.reduce((sum, c) => sum + c.weight, 0);
                let random = Math.random() * totalWeight;
                let picked = pool[0]!;
                for (const candidate of pool) {
                    random -= candidate.weight;
                    if (random <= 0) {
                        picked = candidate;
                        break;
                    }
                }
                selected.add(picked.userId);
                const idx = pool.indexOf(picked);
                if (idx >= 0) pool.splice(idx, 1);
            }
            return selected;
        }

        default:
            return new Set(candidates.map((c) => c.userId));
    }
}

async function isDeciderEligible(
    db: DrizzleD1Database<Record<string, unknown>>,
    requestId: string,
    userId: string,
    currentStepOrder: number,
): Promise<boolean> {
    // Check if user is a selected candidate for the current step
    const rows = await db
        .select({ id: approvalRequestCandidates.id })
        .from(approvalRequestCandidates)
        .innerJoin(
            approvalRequestSteps,
            eq(approvalRequestSteps.id, approvalRequestCandidates.requestStepId),
        )
        .where(
            and(
                eq(approvalRequestSteps.requestId, requestId),
                eq(approvalRequestSteps.stepOrder, currentStepOrder),
                eq(approvalRequestCandidates.userId, userId),
                eq(approvalRequestCandidates.isSelected, true),
            ),
        )
        .limit(1);

    if (rows.length > 0) return true;

    // Check if user has a delegation from an eligible candidate
    const delegationRows = await db
        .select({ delegatorId: approvalDelegations.delegatorId })
        .from(approvalDelegations)
        .where(
            and(
                eq(approvalDelegations.delegateId, userId),
                sql`${approvalDelegations.revokedAt} is null`,
                sql`${approvalDelegations.expiresAt} > datetime('now')`,
            ),
        );

    for (const deleg of delegationRows) {
        const delegatorEligible = await db
            .select({ id: approvalRequestCandidates.id })
            .from(approvalRequestCandidates)
            .innerJoin(
                approvalRequestSteps,
                eq(approvalRequestSteps.id, approvalRequestCandidates.requestStepId),
            )
            .where(
                and(
                    eq(approvalRequestSteps.requestId, requestId),
                    eq(approvalRequestSteps.stepOrder, currentStepOrder),
                    eq(approvalRequestCandidates.userId, deleg.delegatorId),
                    eq(approvalRequestCandidates.isSelected, true),
                ),
            )
            .limit(1);

        if (delegatorEligible.length > 0) return true;
    }

    return false;
}
