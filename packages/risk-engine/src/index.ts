/**
 * Risk-engine package — evaluates risk scores for actions and returns a
 * decision (allow / step_up_sms / step_up_totp / manual_review / deny).
 *
 * Usage:
 *   const engine = createRiskEngine({ db, config, logger });
 *   const result = await engine.evaluate(input);
 */
export { createRiskEngine } from './evaluator.js';
export { collectSignals, type SignalCollector } from './signals.js';
export { ALL_RULES, type RiskRule } from './rules.js';
