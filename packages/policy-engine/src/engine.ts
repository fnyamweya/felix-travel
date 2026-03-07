/**
 * Policy engine — the main entry point. Evaluates action envelopes against
 * published approval policies and returns whether approval is required.
 *
 * Flow:
 * 1. Find all published policies for the action code
 * 2. Evaluate each policy's condition expression against the envelope
 * 3. Select the highest-priority matching policy
 * 4. Check assurance level requirement
 * 5. Compile (or pull from cache) the workflow graph
 * 6. Return PolicyEvaluationResult
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import {
    approvalActions,
    approvalPolicies,
    approvalPolicyVersions,
    approvalPolicyBindings,
    policyCompilationCache,
} from '@felix-travel/db/schema';
import type { ActionEnvelope, PolicyEvaluationResult } from '@felix-travel/types';
import type { Logger } from '@felix-travel/telemetry';
import { evaluateCondition, type ConditionExpression } from './conditions.js';
import { compileWorkflow } from './compiler.js';

export interface PolicyEngineDeps {
    db: DrizzleD1Database<Record<string, unknown>>;
    logger: Logger;
    generateId: () => string;
}

export interface PolicyEngine {
    /**
     * Evaluate whether an action requires approval and/or step-up.
     */
    evaluate(envelope: ActionEnvelope): Promise<PolicyEvaluationResult>;

    /**
     * Invalidate compiled policy cache for a specific policy version.
     */
    invalidateCache(policyVersionId: string): Promise<void>;
}

interface MatchedPolicy {
    policyVersionId: string;
    workflowTemplateId: string;
    requiredAssuranceLevel: number;
    conditionExpression: string;
    priority: number;
    explanation: string;
}

export function createPolicyEngine(deps: PolicyEngineDeps): PolicyEngine {
    const { db, logger, generateId } = deps;

    function nowIso(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    return {
        async evaluate(envelope: ActionEnvelope): Promise<PolicyEvaluationResult> {
            const trace: Array<{ rule: string; result: boolean; reason: string }> = [];

            // 1. Find the approval action
            const actionRows = await db
                .select({ id: approvalActions.id })
                .from(approvalActions)
                .where(
                    and(
                        eq(approvalActions.actionCode, envelope.actionType),
                        eq(approvalActions.isActive, true),
                    ),
                )
                .limit(1);

            if (actionRows.length === 0) {
                trace.push({ rule: 'action_lookup', result: false, reason: `No approval action defined for "${envelope.actionType}"` });
                return {
                    requiresApproval: false,
                    requiresStepUp: false,
                    requiredAssuranceLevel: 0,
                    workflowTemplateId: null,
                    policyVersionId: null,
                    explanation: `No approval policy exists for action "${envelope.actionType}"`,
                    evaluationTrace: trace,
                };
            }

            const actionId = actionRows[0]!.id;
            trace.push({ rule: 'action_lookup', result: true, reason: `Found approval action ${actionId}` });

            // 2. Find all published policies for this action
            const policyRows = await db
                .select({
                    policyId: approvalPolicies.id,
                    policyName: approvalPolicies.name,
                })
                .from(approvalPolicies)
                .where(
                    and(
                        eq(approvalPolicies.actionId, actionId),
                        eq(approvalPolicies.status, 'published'),
                    ),
                );

            if (policyRows.length === 0) {
                trace.push({ rule: 'policy_lookup', result: false, reason: 'No published policies' });
                return {
                    requiresApproval: false,
                    requiresStepUp: false,
                    requiredAssuranceLevel: 0,
                    workflowTemplateId: null,
                    policyVersionId: null,
                    explanation: 'No published approval policies for this action',
                    evaluationTrace: trace,
                };
            }

            // 3. For each policy, get the current published version + bindings
            const now = nowIso();
            const matchedPolicies: MatchedPolicy[] = [];

            for (const policy of policyRows) {
                const versionRows = await db
                    .select()
                    .from(approvalPolicyVersions)
                    .where(eq(approvalPolicyVersions.policyId, policy.policyId))
                    .orderBy(sql`${approvalPolicyVersions.version} desc`)
                    .limit(1);

                if (versionRows.length === 0) continue;
                const version = versionRows[0]!;

                // Check effective date range
                if (version.effectiveFrom && version.effectiveFrom > now) {
                    trace.push({ rule: `policy:${policy.policyName}:effective_from`, result: false, reason: 'Not yet effective' });
                    continue;
                }
                if (version.effectiveTo && version.effectiveTo < now) {
                    trace.push({ rule: `policy:${policy.policyName}:effective_to`, result: false, reason: 'No longer effective' });
                    continue;
                }

                // Evaluate condition expression
                let conditionResult = false;
                try {
                    const expr = JSON.parse(version.conditionExpression) as ConditionExpression;
                    conditionResult = evaluateCondition(expr, envelope);
                } catch {
                    trace.push({ rule: `policy:${policy.policyName}:condition`, result: false, reason: 'Failed to parse condition expression' });
                    continue;
                }

                trace.push({
                    rule: `policy:${policy.policyName}:condition`,
                    result: conditionResult,
                    reason: conditionResult ? 'Condition matched' : 'Condition did not match',
                });

                if (!conditionResult) continue;

                // Get the highest-priority active binding
                const bindingRows = await db
                    .select({ priority: approvalPolicyBindings.priority, scope: approvalPolicyBindings.scope })
                    .from(approvalPolicyBindings)
                    .where(
                        and(
                            eq(approvalPolicyBindings.policyVersionId, version.id),
                            eq(approvalPolicyBindings.isActive, true),
                        ),
                    )
                    .orderBy(sql`${approvalPolicyBindings.priority} desc`)
                    .limit(1);

                const priority = bindingRows.length > 0 ? bindingRows[0]!.priority : 0;

                // Check scope match (global always matches, provider scope must match)
                if (bindingRows.length > 0) {
                    const bindingScope = bindingRows[0]!.scope;
                    if (bindingScope !== 'global' && envelope.providerScope) {
                        const expectedScope = `provider:${envelope.providerScope}`;
                        if (bindingScope !== expectedScope) {
                            trace.push({
                                rule: `policy:${policy.policyName}:scope`,
                                result: false,
                                reason: `Scope ${bindingScope} does not match ${expectedScope}`,
                            });
                            continue;
                        }
                    }
                }

                matchedPolicies.push({
                    policyVersionId: version.id,
                    workflowTemplateId: version.workflowTemplateId,
                    requiredAssuranceLevel: version.requiredAssuranceLevel,
                    conditionExpression: version.conditionExpression,
                    priority,
                    explanation: `Policy "${policy.policyName}" matched`,
                });
            }

            // 4. No matching policies → no approval required
            if (matchedPolicies.length === 0) {
                return {
                    requiresApproval: false,
                    requiresStepUp: false,
                    requiredAssuranceLevel: 0,
                    workflowTemplateId: null,
                    policyVersionId: null,
                    explanation: 'No matching approval policies for this action context',
                    evaluationTrace: trace,
                };
            }

            // 5. Select highest-priority matching policy
            matchedPolicies.sort((a, b) => b.priority - a.priority);
            const winner = matchedPolicies[0]!;

            trace.push({
                rule: 'policy_selection',
                result: true,
                reason: winner.explanation,
            });

            // 6. Check assurance level
            const requiresStepUp = envelope.sessionAssuranceLevel < winner.requiredAssuranceLevel;
            if (requiresStepUp) {
                trace.push({
                    rule: 'assurance_check',
                    result: true,
                    reason: `Session assurance ${envelope.sessionAssuranceLevel} < required ${winner.requiredAssuranceLevel}`,
                });
            }

            // 7. Compile workflow (check cache first)
            const cacheRows = await db
                .select({ compiledGraph: policyCompilationCache.compiledGraph })
                .from(policyCompilationCache)
                .where(eq(policyCompilationCache.policyVersionId, winner.policyVersionId))
                .limit(1);

            if (cacheRows.length === 0) {
                // Compile and cache
                const compiled = await compileWorkflow(db, winner.workflowTemplateId);
                await db.insert(policyCompilationCache).values({
                    id: generateId(),
                    policyVersionId: winner.policyVersionId,
                    compiledGraph: JSON.stringify(compiled),
                    compiledAt: nowIso(),
                    inputHash: winner.workflowTemplateId, // simple hash for now
                });
                logger.debug('workflow compiled and cached', { policyVersionId: winner.policyVersionId });
            }

            logger.info('policy evaluation complete', {
                actionType: envelope.actionType,
                requiresApproval: true,
                requiresStepUp,
                policyVersionId: winner.policyVersionId,
            });

            return {
                requiresApproval: true,
                requiresStepUp,
                requiredAssuranceLevel: winner.requiredAssuranceLevel,
                workflowTemplateId: winner.workflowTemplateId,
                policyVersionId: winner.policyVersionId,
                explanation: winner.explanation,
                evaluationTrace: trace,
            };
        },

        async invalidateCache(policyVersionId: string): Promise<void> {
            await db
                .delete(policyCompilationCache)
                .where(eq(policyCompilationCache.policyVersionId, policyVersionId));
            logger.info('policy cache invalidated', { policyVersionId });
        },
    };
}
