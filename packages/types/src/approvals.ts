/**
 * Approval (maker-checker) types — policies, workflows, requests, decisions.
 *
 * The approval system is fully database-driven and runtime-resolved.
 * Domain services pass action envelopes into the engine, which evaluates
 * compiled policy graphs to determine whether approval is required,
 * how many steps, which approvers, and what assurance level is needed.
 */
import type { DateTimeString } from './common.js';

// ----------------------------------------------------------------
// Policy definition types
// ----------------------------------------------------------------

export type WorkflowMode =
    | 'single'
    | 'multi_step_sequential'
    | 'multi_step_parallel'
    | 'hierarchical'
    | 'random'
    | 'weighted_random'
    | 'quorum'
    | 'conditional_branch'
    | 'escalation'
    | 'delegated'
    | 'sampling'
    | 'shadow_review';

export type ApprovalPolicyStatus = 'draft' | 'published' | 'archived';
export type ApprovalRequestStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type ApprovalDecisionType = 'approve' | 'reject' | 'escalate' | 'abstain';
export type ApprovalStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'escalated' | 'expired';
export type CandidateSelectionMode = 'all' | 'any' | 'random' | 'weighted_random' | 'quorum';

export interface ApprovalAction {
    id: string;
    /** Unique action code, e.g. "refund.approve", "payout.run" */
    actionCode: string;
    name: string;
    description: string;
    /** The resource type this action applies to */
    resourceType: string;
    isActive: boolean;
    createdAt: DateTimeString;
}

export interface ApprovalPolicy {
    id: string;
    actionId: string;
    name: string;
    description: string;
    status: ApprovalPolicyStatus;
    /** Current published version number */
    currentVersion: number;
    createdAt: DateTimeString;
    updatedAt: DateTimeString;
}

export interface ApprovalPolicyVersion {
    id: string;
    policyId: string;
    version: number;
    /** JSON condition expression for when this policy applies */
    conditionExpression: string;
    workflowTemplateId: string;
    /** Min assurance level required to initiate this action */
    requiredAssuranceLevel: number;
    effectiveFrom: DateTimeString | null;
    effectiveTo: DateTimeString | null;
    publishedAt: DateTimeString | null;
    createdAt: DateTimeString;
}

export interface ApprovalWorkflowTemplate {
    id: string;
    name: string;
    description: string;
    mode: WorkflowMode;
    isActive: boolean;
    createdAt: DateTimeString;
    updatedAt: DateTimeString;
}

export interface ApprovalWorkflowStep {
    id: string;
    templateId: string;
    stepOrder: number;
    name: string;
    candidateSelectionMode: CandidateSelectionMode;
    /** Minimum approvals needed for quorum mode */
    quorumCount: number | null;
    /** Timeout in minutes before escalation triggers */
    timeoutMinutes: number | null;
    isActive: boolean;
}

export interface ApprovalStepCandidateRule {
    id: string;
    stepId: string;
    /**
     * Type of matching expression:
     * - "role": matches users with a given role
     * - "capability": matches users with a given permission
     * - "org_unit": matches users in a given org unit
     * - "expression": free-form expression evaluated at runtime
     */
    ruleType: 'role' | 'capability' | 'org_unit' | 'expression';
    /** The role slug, capability code, org unit ID, or expression string */
    ruleValue: string;
    /** Weight for weighted_random selection */
    weight: number;
}

// ----------------------------------------------------------------
// Runtime request/decision types
// ----------------------------------------------------------------

export interface ActionEnvelope {
    actionType: string;
    resourceType: string;
    resourceId: string;
    actor: { userId: string; role: string; providerId?: string };
    subject?: { userId?: string; providerId?: string };
    context: Record<string, unknown>;
    requestedChanges?: Record<string, unknown>;
    risk?: { score: number; reasons: string[]; action: string };
    moneyImpact?: { amount: number; currency: string };
    sessionAssuranceLevel: number;
    providerScope?: string;
    tenantScope?: string;
}

export interface PolicyEvaluationResult {
    requiresApproval: boolean;
    requiresStepUp: boolean;
    requiredAssuranceLevel: number;
    workflowTemplateId: string | null;
    policyVersionId: string | null;
    /** Human-readable explanation of why approval is/isn't required */
    explanation: string;
    /** Full evaluation trace for audit and debugging */
    evaluationTrace: Array<{ rule: string; result: boolean; reason: string }>;
}

export interface ApprovalRequest {
    id: string;
    actionId: string;
    policyVersionId: string;
    workflowTemplateId: string;
    /** JSON snapshot of the compiled workflow at request creation time */
    workflowSnapshot: string;
    requestedBy: string;
    resourceType: string;
    resourceId: string;
    status: ApprovalRequestStatus;
    /** JSON of the original action envelope */
    actionEnvelope: string;
    /** JSON of the risk evaluation at request time */
    riskSnapshot: string | null;
    currentStepOrder: number;
    expiresAt: DateTimeString | null;
    completedAt: DateTimeString | null;
    createdAt: DateTimeString;
    updatedAt: DateTimeString;
}

export interface ApprovalDecision {
    id: string;
    requestId: string;
    stepId: string;
    decidedBy: string;
    decision: ApprovalDecisionType;
    reason: string | null;
    /** Assurance level of the decider's session at decision time */
    sessionAssuranceLevel: number;
    createdAt: DateTimeString;
}

export interface ApprovalDelegation {
    id: string;
    delegatorId: string;
    delegateId: string;
    /** Comma-separated action codes, or '*' for all */
    scope: string;
    expiresAt: DateTimeString;
    revokedAt: DateTimeString | null;
    createdAt: DateTimeString;
}
