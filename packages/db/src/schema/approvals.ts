/**
 * Approval (maker-checker) schema — the full database-driven approval engine.
 *
 * Architecture:
 * - Definition layer: actions, policies, versions, bindings, templates, steps, rules
 * - Runtime layer: requests, decisions, delegations, evidence, event log
 *
 * All approval logic is runtime-resolved from these tables.
 * Domain services never hardcode approval branching; they pass action envelopes
 * to the engine which evaluates compiled policy graphs from this schema.
 */
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

// ================================================================
// DEFINITION LAYER — authored by admins, versioned, cached
// ================================================================

export const approvalActions = sqliteTable(
    'approval_actions',
    {
        id: text('id').primaryKey(),
        /** Unique action code, e.g. "refund.approve", "payout.run", "role.grant.privileged" */
        actionCode: text('action_code').notNull(),
        name: text('name').notNull(),
        description: text('description').notNull().default(''),
        resourceType: text('resource_type').notNull(),
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        actionCodeIdx: uniqueIndex('uq_approval_actions_code').on(table.actionCode),
    })
);

export const approvalPolicies = sqliteTable(
    'approval_policies',
    {
        id: text('id').primaryKey(),
        actionId: text('action_id')
            .notNull()
            .references(() => approvalActions.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        description: text('description').notNull().default(''),
        status: text('status', { enum: ['draft', 'published', 'archived'] })
            .notNull()
            .default('draft'),
        currentVersion: integer('current_version').notNull().default(1),
        createdAt: text('created_at').notNull().default('(datetime())'),
        updatedAt: text('updated_at').notNull().default('(datetime())'),
    },
    (table) => ({
        actionIdx: index('idx_approval_policies_action').on(table.actionId),
        statusIdx: index('idx_approval_policies_status').on(table.status),
    })
);

export const approvalPolicyVersions = sqliteTable(
    'approval_policy_versions',
    {
        id: text('id').primaryKey(),
        policyId: text('policy_id')
            .notNull()
            .references(() => approvalPolicies.id, { onDelete: 'cascade' }),
        version: integer('version').notNull(),
        /**
         * JSON condition expression evaluated at runtime to determine if this
         * policy applies. Format: { "operator": "and", "conditions": [...] }
         * Supports: amount thresholds, role checks, provider scope, risk score, etc.
         */
        conditionExpression: text('condition_expression').notNull().default('{"always": true}'),
        workflowTemplateId: text('workflow_template_id')
            .notNull()
            .references(() => approvalWorkflowTemplates.id),
        /** Minimum session assurance level needed to initiate this action */
        requiredAssuranceLevel: integer('required_assurance_level').notNull().default(0),
        effectiveFrom: text('effective_from'),
        effectiveTo: text('effective_to'),
        publishedAt: text('published_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        policyVersionIdx: uniqueIndex('uq_policy_versions_policy_version').on(
            table.policyId,
            table.version
        ),
    })
);

export const approvalPolicyBindings = sqliteTable(
    'approval_policy_bindings',
    {
        id: text('id').primaryKey(),
        policyVersionId: text('policy_version_id')
            .notNull()
            .references(() => approvalPolicyVersions.id, { onDelete: 'cascade' }),
        /** Binding scope: "global", "provider:{id}", "org_unit:{id}" */
        scope: text('scope').notNull().default('global'),
        /** Priority for conflict resolution — higher wins */
        priority: integer('priority').notNull().default(0),
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        policyVersionIdx: index('idx_policy_bindings_version').on(table.policyVersionId),
    })
);

export const approvalWorkflowTemplates = sqliteTable(
    'approval_workflow_templates',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        description: text('description').notNull().default(''),
        mode: text('mode', {
            enum: [
                'single',
                'multi_step_sequential',
                'multi_step_parallel',
                'hierarchical',
                'random',
                'weighted_random',
                'quorum',
                'conditional_branch',
                'escalation',
                'delegated',
                'sampling',
                'shadow_review',
            ],
        }).notNull(),
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
        createdAt: text('created_at').notNull().default('(datetime())'),
        updatedAt: text('updated_at').notNull().default('(datetime())'),
    }
);

export const approvalWorkflowSteps = sqliteTable(
    'approval_workflow_steps',
    {
        id: text('id').primaryKey(),
        templateId: text('template_id')
            .notNull()
            .references(() => approvalWorkflowTemplates.id, { onDelete: 'cascade' }),
        stepOrder: integer('step_order').notNull(),
        name: text('name').notNull(),
        candidateSelectionMode: text('candidate_selection_mode', {
            enum: ['all', 'any', 'random', 'weighted_random', 'quorum'],
        })
            .notNull()
            .default('any'),
        quorumCount: integer('quorum_count'),
        /** Minutes before escalation. Null = no timeout. */
        timeoutMinutes: integer('timeout_minutes'),
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    },
    (table) => ({
        templateOrderIdx: uniqueIndex('uq_workflow_steps_template_order').on(
            table.templateId,
            table.stepOrder
        ),
    })
);

export const approvalStepCandidateRules = sqliteTable(
    'approval_step_candidate_rules',
    {
        id: text('id').primaryKey(),
        stepId: text('step_id')
            .notNull()
            .references(() => approvalWorkflowSteps.id, { onDelete: 'cascade' }),
        /**
         * How to match potential approvers:
         * - "role": users with this role slug
         * - "capability": users with this permission code
         * - "org_unit": users in this org unit
         * - "expression": evaluated at runtime (e.g. "actor.providerId != subject.providerId")
         */
        ruleType: text('rule_type', { enum: ['role', 'capability', 'org_unit', 'expression'] }).notNull(),
        ruleValue: text('rule_value').notNull(),
        /** Weight for weighted_random candidate selection */
        weight: integer('weight').notNull().default(1),
    },
    (table) => ({
        stepIdx: index('idx_step_candidate_rules_step').on(table.stepId),
    })
);

export const approvalStepConditions = sqliteTable(
    'approval_step_conditions',
    {
        id: text('id').primaryKey(),
        stepId: text('step_id')
            .notNull()
            .references(() => approvalWorkflowSteps.id, { onDelete: 'cascade' }),
        /** JSON condition for conditional branching */
        conditionExpression: text('condition_expression').notNull(),
        /** Step to jump to if condition is true */
        targetStepId: text('target_step_id'),
    }
);

export const approvalStepEscalations = sqliteTable(
    'approval_step_escalations',
    {
        id: text('id').primaryKey(),
        stepId: text('step_id')
            .notNull()
            .references(() => approvalWorkflowSteps.id, { onDelete: 'cascade' }),
        escalateToStepId: text('escalate_to_step_id'),
        /** Escalation triggers after this many minutes of inaction */
        afterMinutes: integer('after_minutes').notNull(),
        /** Notify these role(s) on escalation */
        notifyRoles: text('notify_roles').notNull().default('[]'),
    }
);

// ================================================================
// RUNTIME LAYER — created during approval request lifecycle
// ================================================================

export const approvalRequests = sqliteTable(
    'approval_requests',
    {
        id: text('id').primaryKey(),
        actionId: text('action_id')
            .notNull()
            .references(() => approvalActions.id),
        policyVersionId: text('policy_version_id')
            .notNull()
            .references(() => approvalPolicyVersions.id),
        workflowTemplateId: text('workflow_template_id')
            .notNull()
            .references(() => approvalWorkflowTemplates.id),
        /**
         * Compiled workflow snapshot at creation time. Ensures the exact workflow
         * that was in effect is preserved even if the template changes later.
         */
        workflowSnapshot: text('workflow_snapshot').notNull(),
        requestedBy: text('requested_by')
            .notNull()
            .references(() => users.id),
        resourceType: text('resource_type').notNull(),
        resourceId: text('resource_id').notNull(),
        status: text('status', {
            enum: ['pending', 'in_progress', 'approved', 'rejected', 'expired', 'cancelled'],
        })
            .notNull()
            .default('pending'),
        /** JSON of the original ActionEnvelope */
        actionEnvelope: text('action_envelope').notNull(),
        /** JSON of risk evaluation at request time */
        riskSnapshot: text('risk_snapshot'),
        currentStepOrder: integer('current_step_order').notNull().default(1),
        expiresAt: text('expires_at'),
        completedAt: text('completed_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
        updatedAt: text('updated_at').notNull().default('(datetime())'),
    },
    (table) => ({
        statusIdx: index('idx_approval_requests_status').on(table.status),
        requestorIdx: index('idx_approval_requests_requestor').on(table.requestedBy),
        resourceIdx: index('idx_approval_requests_resource').on(table.resourceType, table.resourceId),
    })
);

export const approvalRequestSteps = sqliteTable(
    'approval_request_steps',
    {
        id: text('id').primaryKey(),
        requestId: text('request_id')
            .notNull()
            .references(() => approvalRequests.id, { onDelete: 'cascade' }),
        stepId: text('step_id')
            .notNull()
            .references(() => approvalWorkflowSteps.id),
        stepOrder: integer('step_order').notNull(),
        status: text('status', {
            enum: ['pending', 'in_progress', 'completed', 'skipped', 'escalated', 'expired'],
        })
            .notNull()
            .default('pending'),
        startedAt: text('started_at'),
        completedAt: text('completed_at'),
    },
    (table) => ({
        requestIdx: index('idx_request_steps_request').on(table.requestId),
    })
);

export const approvalRequestCandidates = sqliteTable(
    'approval_request_candidates',
    {
        id: text('id').primaryKey(),
        requestStepId: text('request_step_id')
            .notNull()
            .references(() => approvalRequestSteps.id, { onDelete: 'cascade' }),
        userId: text('user_id')
            .notNull()
            .references(() => users.id),
        /** Whether this candidate was selected (for random/weighted modes) */
        isSelected: integer('is_selected', { mode: 'boolean' }).notNull().default(false),
        notifiedAt: text('notified_at'),
    },
    (table) => ({
        stepIdx: index('idx_request_candidates_step').on(table.requestStepId),
        userIdx: index('idx_request_candidates_user').on(table.userId),
    })
);

export const approvalDecisions = sqliteTable(
    'approval_decisions',
    {
        id: text('id').primaryKey(),
        requestId: text('request_id')
            .notNull()
            .references(() => approvalRequests.id, { onDelete: 'cascade' }),
        stepId: text('step_id')
            .notNull()
            .references(() => approvalWorkflowSteps.id),
        decidedBy: text('decided_by')
            .notNull()
            .references(() => users.id),
        decision: text('decision', { enum: ['approve', 'reject', 'escalate', 'abstain'] }).notNull(),
        reason: text('reason'),
        sessionAssuranceLevel: integer('session_assurance_level').notNull().default(0),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        requestIdx: index('idx_approval_decisions_request').on(table.requestId),
        deciderIdx: index('idx_approval_decisions_decider').on(table.decidedBy),
    })
);

export const approvalDelegations = sqliteTable(
    'approval_delegations',
    {
        id: text('id').primaryKey(),
        delegatorId: text('delegator_id')
            .notNull()
            .references(() => users.id),
        delegateId: text('delegate_id')
            .notNull()
            .references(() => users.id),
        /** Comma-separated action codes, or '*' for all */
        scope: text('scope').notNull().default('*'),
        expiresAt: text('expires_at').notNull(),
        revokedAt: text('revoked_at'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        delegatorIdx: index('idx_delegations_delegator').on(table.delegatorId),
        delegateIdx: index('idx_delegations_delegate').on(table.delegateId),
        expiresIdx: index('idx_delegations_expires').on(table.expiresAt),
    })
);

export const approvalEvidence = sqliteTable(
    'approval_evidence',
    {
        id: text('id').primaryKey(),
        requestId: text('request_id')
            .notNull()
            .references(() => approvalRequests.id, { onDelete: 'cascade' }),
        uploadedBy: text('uploaded_by')
            .notNull()
            .references(() => users.id),
        /** R2 key or inline text */
        contentType: text('content_type').notNull(),
        content: text('content').notNull(),
        createdAt: text('created_at').notNull().default('(datetime())'),
    }
);

export const approvalComments = sqliteTable(
    'approval_comments',
    {
        id: text('id').primaryKey(),
        requestId: text('request_id')
            .notNull()
            .references(() => approvalRequests.id, { onDelete: 'cascade' }),
        authorId: text('author_id')
            .notNull()
            .references(() => users.id),
        body: text('body').notNull(),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        requestIdx: index('idx_approval_comments_request').on(table.requestId),
    })
);

export const approvalEventLog = sqliteTable(
    'approval_event_log',
    {
        id: text('id').primaryKey(),
        requestId: text('request_id')
            .notNull()
            .references(() => approvalRequests.id, { onDelete: 'cascade' }),
        eventType: text('event_type').notNull(),
        actorId: text('actor_id'),
        /** JSON details of the event */
        details: text('details'),
        createdAt: text('created_at').notNull().default('(datetime())'),
    },
    (table) => ({
        requestIdx: index('idx_approval_event_log_request').on(table.requestId),
    })
);

export const approvalRandomizationEvents = sqliteTable(
    'approval_randomization_events',
    {
        id: text('id').primaryKey(),
        requestStepId: text('request_step_id')
            .notNull()
            .references(() => approvalRequestSteps.id, { onDelete: 'cascade' }),
        /** Stored seed for deterministic reproducibility */
        seed: text('seed').notNull(),
        /** JSON array of all eligible candidates and their weights at selection time */
        candidatePool: text('candidate_pool').notNull(),
        /** JSON array of selected candidate user IDs */
        selectedCandidates: text('selected_candidates').notNull(),
        createdAt: text('created_at').notNull().default('(datetime())'),
    }
);

export const policyCompilationCache = sqliteTable(
    'policy_compilation_cache',
    {
        id: text('id').primaryKey(),
        policyVersionId: text('policy_version_id')
            .notNull()
            .references(() => approvalPolicyVersions.id, { onDelete: 'cascade' }),
        /** JSON of the compiled workflow graph */
        compiledGraph: text('compiled_graph').notNull(),
        compiledAt: text('compiled_at').notNull().default('(datetime())'),
        /** Hash of inputs used for compilation — if inputs change, cache is invalid */
        inputHash: text('input_hash').notNull(),
    },
    (table) => ({
        versionIdx: uniqueIndex('uq_policy_cache_version').on(table.policyVersionId),
    })
);
