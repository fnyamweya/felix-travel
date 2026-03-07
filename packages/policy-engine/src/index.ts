/**
 * Policy engine — evaluates approval policies, compiles workflow graphs,
 * resolves approval candidates, and provides the core API for the
 * maker-checker system.
 */
export { createPolicyEngine, type PolicyEngine, type PolicyEngineDeps } from './engine.js';
export { evaluateCondition, type ConditionExpression } from './conditions.js';
export { compileWorkflow, type CompiledWorkflow, type CompiledStep } from './compiler.js';
export { resolveCandidates, type CandidateResolver } from './candidates.js';
