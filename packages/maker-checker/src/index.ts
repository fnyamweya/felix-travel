/**
 * Maker-checker package — runtime approval request lifecycle management.
 *
 * The policy-engine decides IF approval is needed. This package manages
 * the lifecycle AFTER that decision: creating requests, resolving candidates,
 * recording decisions, advancing steps, and completing workflows.
 */
export { createApprovalService, type ApprovalService, type ApprovalServiceDeps } from './approval-service.js';
export { createDelegationService, type DelegationService } from './delegation-service.js';
