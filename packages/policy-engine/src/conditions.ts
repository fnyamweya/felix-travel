/**
 * Condition expression evaluator — evaluates JSON condition expressions
 * from approval policy versions against action envelopes.
 *
 * Condition format:
 *   { "always": true }  — always matches
 *   { "field": "moneyImpact.amount", "op": "gte", "value": 1000000 }
 *   { "operator": "and", "conditions": [<sub-condition>, ...] }
 *   { "operator": "or", "conditions": [<sub-condition>, ...] }
 *   { "operator": "not", "condition": <sub-condition> }
 */
import type { ActionEnvelope } from '@felix-travel/types';

export type ConditionExpression =
    | { always: true }
    | { field: string; op: ConditionOp; value: unknown }
    | { operator: 'and'; conditions: ConditionExpression[] }
    | { operator: 'or'; conditions: ConditionExpression[] }
    | { operator: 'not'; condition: ConditionExpression };

type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'exists';

/**
 * Evaluate a condition expression against an action envelope.
 * Returns true if the condition is satisfied.
 */
export function evaluateCondition(
    condition: ConditionExpression,
    envelope: ActionEnvelope,
): boolean {
    if ('always' in condition) {
        return condition.always === true;
    }

    if ('operator' in condition) {
        switch (condition.operator) {
            case 'and':
                return condition.conditions.every((c) => evaluateCondition(c, envelope));
            case 'or':
                return condition.conditions.some((c) => evaluateCondition(c, envelope));
            case 'not':
                return !evaluateCondition(condition.condition, envelope);
            default:
                return false;
        }
    }

    if ('field' in condition) {
        const fieldValue = resolveField(condition.field, envelope as unknown as Record<string, unknown>);
        return compareValues(fieldValue, condition.op, condition.value);
    }

    return false;
}

function resolveField(path: string, obj: Record<string, unknown>): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}

function compareValues(fieldValue: unknown, op: ConditionOp, value: unknown): boolean {
    switch (op) {
        case 'eq':
            return fieldValue === value;
        case 'neq':
            return fieldValue !== value;
        case 'gt':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
        case 'gte':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue >= value;
        case 'lt':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
        case 'lte':
            return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue <= value;
        case 'in':
            return Array.isArray(value) && value.includes(fieldValue);
        case 'not_in':
            return Array.isArray(value) && !value.includes(fieldValue);
        case 'contains':
            return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value);
        case 'exists':
            return fieldValue !== null && fieldValue !== undefined;
        default:
            return false;
    }
}
