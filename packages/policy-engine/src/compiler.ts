/**
 * Workflow compiler — reads a workflow template + its steps from the database
 * and produces a serializable compiled graph that is snapshot-frozen into
 * each approval request at creation time.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import {
    approvalWorkflowTemplates,
    approvalWorkflowSteps,
    approvalStepCandidateRules,
    approvalStepConditions,
    approvalStepEscalations,
} from '@felix-travel/db/schema';
import type { WorkflowMode, CandidateSelectionMode } from '@felix-travel/types';

export interface CompiledCandidateRule {
    ruleType: 'role' | 'capability' | 'org_unit' | 'expression';
    ruleValue: string;
    weight: number;
}

export interface CompiledStepCondition {
    conditionExpression: string;
    targetStepId: string | null;
}

export interface CompiledStepEscalation {
    escalateToStepId: string | null;
    afterMinutes: number;
    notifyRoles: string[];
}

export interface CompiledStep {
    stepId: string;
    stepOrder: number;
    name: string;
    candidateSelectionMode: CandidateSelectionMode;
    quorumCount: number | null;
    timeoutMinutes: number | null;
    candidateRules: CompiledCandidateRule[];
    conditions: CompiledStepCondition[];
    escalations: CompiledStepEscalation[];
}

export interface CompiledWorkflow {
    templateId: string;
    templateName: string;
    mode: WorkflowMode;
    steps: CompiledStep[];
    compiledAt: string;
}

/**
 * Compile a workflow template from the database into a serializable graph.
 * The resulting JSON is stored as workflow_snapshot on approval requests.
 */
export async function compileWorkflow(
    db: DrizzleD1Database<Record<string, unknown>>,
    templateId: string,
): Promise<CompiledWorkflow> {
    // Fetch template
    const templates = await db
        .select()
        .from(approvalWorkflowTemplates)
        .where(eq(approvalWorkflowTemplates.id, templateId))
        .limit(1);

    if (templates.length === 0) {
        throw new Error(`Workflow template not found: ${templateId}`);
    }
    const template = templates[0]!;

    // Fetch all active steps ordered by step_order
    const stepsRows = await db
        .select()
        .from(approvalWorkflowSteps)
        .where(eq(approvalWorkflowSteps.templateId, templateId))
        .orderBy(approvalWorkflowSteps.stepOrder);

    const activeSteps = stepsRows.filter((s) => s.isActive);

    // Fetch candidate rules, conditions, and escalations for all steps in parallel
    const stepIds = activeSteps.map((s) => s.id);

    const [allCandidateRules, allConditions, allEscalations] = await Promise.all([
        stepIds.length > 0
            ? db.select().from(approvalStepCandidateRules)
            : Promise.resolve([]),
        stepIds.length > 0
            ? db.select().from(approvalStepConditions)
            : Promise.resolve([]),
        stepIds.length > 0
            ? db.select().from(approvalStepEscalations)
            : Promise.resolve([]),
    ]);

    // Group by step ID
    const candidatesByStep = new Map<string, CompiledCandidateRule[]>();
    const conditionsByStep = new Map<string, CompiledStepCondition[]>();
    const escalationsByStep = new Map<string, CompiledStepEscalation[]>();

    for (const rule of allCandidateRules) {
        if (!stepIds.includes(rule.stepId)) continue;
        const list = candidatesByStep.get(rule.stepId) ?? [];
        list.push({
            ruleType: rule.ruleType as CompiledCandidateRule['ruleType'],
            ruleValue: rule.ruleValue,
            weight: rule.weight,
        });
        candidatesByStep.set(rule.stepId, list);
    }

    for (const cond of allConditions) {
        if (!stepIds.includes(cond.stepId)) continue;
        const list = conditionsByStep.get(cond.stepId) ?? [];
        list.push({
            conditionExpression: cond.conditionExpression,
            targetStepId: cond.targetStepId,
        });
        conditionsByStep.set(cond.stepId, list);
    }

    for (const esc of allEscalations) {
        if (!stepIds.includes(esc.stepId)) continue;
        const list = escalationsByStep.get(esc.stepId) ?? [];
        let notifyRoles: string[] = [];
        try {
            notifyRoles = JSON.parse(esc.notifyRoles) as string[];
        } catch {
            // malformed JSON, default to empty
        }
        list.push({
            escalateToStepId: esc.escalateToStepId,
            afterMinutes: esc.afterMinutes,
            notifyRoles,
        });
        escalationsByStep.set(esc.stepId, list);
    }

    const compiledSteps: CompiledStep[] = activeSteps.map((step) => ({
        stepId: step.id,
        stepOrder: step.stepOrder,
        name: step.name,
        candidateSelectionMode: step.candidateSelectionMode as CandidateSelectionMode,
        quorumCount: step.quorumCount,
        timeoutMinutes: step.timeoutMinutes,
        candidateRules: candidatesByStep.get(step.id) ?? [],
        conditions: conditionsByStep.get(step.id) ?? [],
        escalations: escalationsByStep.get(step.id) ?? [],
    }));

    return {
        templateId: template.id,
        templateName: template.name,
        mode: template.mode as WorkflowMode,
        steps: compiledSteps,
        compiledAt: new Date().toISOString(),
    };
}
