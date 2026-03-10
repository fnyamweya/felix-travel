/**
 * Charge Engine routes — /api/v1/charges
 *
 * Admin: Charge Definition Management
 *   GET    /definitions                        List all charge definitions
 *   POST   /definitions                        Create a charge definition
 *   GET    /definitions/:id                    Get a charge definition
 *   PATCH  /definitions/:id                    Update a charge definition
 *
 * Admin: Rule Sets
 *   POST   /rule-sets                          Create a rule set
 *
 * Admin: Rules
 *   POST   /rules                              Create a rule
 *   PATCH  /rules/:id                          Update a rule (rate change with audit trail)
 *
 * Admin: Dependencies
 *   POST   /dependencies                       Add a dependency between charge definitions
 *
 * Simulation (Admin/Agent)
 *   POST   /simulate                           Simulate charge calculation (dry-run)
 *
 * Booking Charges (read-only for appropriate roles)
 *   GET    /bookings/:bookingId                Get computed charges for a booking
 *
 * Payout & Refund Charges
 *   GET    /payouts/:payoutId                  Get charge deductions for a payout
 *   GET    /refunds/:refundId                  Get charge reversals for a refund
 *
 * Reference Data
 *   GET    /jurisdiction/:country              Get jurisdiction profile
 *   GET    /tax-codes/:country                 List tax codes for a country
 */
import { Hono } from 'hono';
import type { Env } from '../../bindings.js';
import type { SessionContext } from '@felix-travel/types';
import { requireAuth } from '@felix-travel/auth';
import { ChargeService } from '../../services/charge.service.js';
import { success } from '../../lib/response.js';
import { AppError, ValidationError } from '../../lib/errors.js';
import {
  createChargeDefinitionSchema,
  updateChargeDefinitionSchema,
  createChargeRuleSetSchema,
  createChargeRuleSchema,
  updateChargeRuleSchema,
  createChargeDependencySchema,
  chargeSimulationSchema,
} from '@felix-travel/validation';

type HonoEnv = {
  Bindings: Env;
  Variables: { session: SessionContext };
};

export const chargeRoutes = new Hono<HonoEnv>();

chargeRoutes.use('*', requireAuth);

function getSvc(c: { env: Env }) {
  return new ChargeService(c.env);
}

function requireAdminOrAgent(session: SessionContext) {
  if (session.role !== 'admin' && session.role !== 'agent') {
    throw new AppError('FORBIDDEN', 'Forbidden', 403);
  }
}

function requireAdmin(session: SessionContext) {
  if (session.role !== 'admin') {
    throw new AppError('FORBIDDEN', 'Forbidden — admin only', 403);
  }
}

// ── Definitions ───────────────────────────────────────────────────────────────

chargeRoutes.get('/definitions', async (c) => {
  requireAdminOrAgent(c.get('session'));
  const svc = getSvc(c);
  const definitions = await svc.listDefinitions();
  return c.json(success(definitions));
});

chargeRoutes.post('/definitions', async (c) => {
  requireAdmin(c.get('session'));
  const svc = getSvc(c);
  const session = c.get('session');
  const body = await c.req.json();
  const parsed = createChargeDefinitionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid charge definition', { issues: parsed.error.flatten().fieldErrors });
  }
  const def = await svc.createDefinition(parsed.data as Parameters<typeof svc.createDefinition>[0], session);
  return c.json(success(def), 201);
});

chargeRoutes.get('/definitions/:id', async (c) => {
  requireAdminOrAgent(c.get('session'));
  const svc = getSvc(c);
  const def = await svc.getDefinition(c.req.param('id'));
  return c.json(success(def));
});

chargeRoutes.patch('/definitions/:id', async (c) => {
  requireAdmin(c.get('session'));
  const svc = getSvc(c);
  const body = await c.req.json();
  const parsed = updateChargeDefinitionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid update', { issues: parsed.error.flatten().fieldErrors });
  }
  const updated = await svc.updateDefinition(c.req.param('id'), parsed.data as any);
  return c.json(success(updated));
});

// ── Rule Sets ─────────────────────────────────────────────────────────────────

chargeRoutes.post('/rule-sets', async (c) => {
  requireAdmin(c.get('session'));
  const svc = getSvc(c);
  const body = await c.req.json();
  const parsed = createChargeRuleSetSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid rule set', { issues: parsed.error.flatten().fieldErrors });
  }
  const rs = await svc.createRuleSet(parsed.data as Parameters<typeof svc.createRuleSet>[0]);
  return c.json(success(rs), 201);
});

chargeRoutes.get('/rule-sets', async (c) => {
  requireAdminOrAgent(c.get('session'));
  const svc = getSvc(c);
  const chargeDefinitionId = c.req.query('chargeDefinitionId');
  const ruleSets = await svc.listRuleSets(chargeDefinitionId);
  return c.json(success(ruleSets));
});

// ── Rules ─────────────────────────────────────────────────────────────────────

chargeRoutes.post('/rules', async (c) => {
  requireAdmin(c.get('session'));
  const svc = getSvc(c);
  const body = await c.req.json();
  const parsed = createChargeRuleSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid rule', { issues: parsed.error.flatten().fieldErrors });
  }
  const rule = await svc.createRule(parsed.data as any);
  return c.json(success(rule), 201);
});

chargeRoutes.get('/rules', async (c) => {
  requireAdminOrAgent(c.get('session'));
  const svc = getSvc(c);
  const ruleSetId = c.req.query('ruleSetId');
  const rules = await svc.listRules(ruleSetId);
  return c.json(success(rules));
});

chargeRoutes.patch('/rules/:id', async (c) => {
  requireAdmin(c.get('session'));
  const svc = getSvc(c);
  const session = c.get('session');
  const body = await c.req.json();
  const parsed = updateChargeRuleSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid rule update', { issues: parsed.error.flatten().fieldErrors });
  }
  const result = await svc.updateRule(c.req.param('id'), parsed.data as any, session);
  return c.json(success(result));
});

// ── Dependencies ──────────────────────────────────────────────────────────────

chargeRoutes.post('/dependencies', async (c) => {
  requireAdmin(c.get('session'));
  const svc = getSvc(c);
  const body = await c.req.json();
  const parsed = createChargeDependencySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid dependency', { issues: parsed.error.flatten().fieldErrors });
  }
  const dep = await svc.addDependency(parsed.data);
  return c.json(success(dep), 201);
});

chargeRoutes.get('/dependencies', async (c) => {
  requireAdminOrAgent(c.get('session'));
  const svc = getSvc(c);
  const chargeDefinitionId = c.req.query('chargeDefinitionId');
  const dependencies = await svc.listDependencies(chargeDefinitionId);
  return c.json(success(dependencies));
});

// ── Simulation ─────────────────────────────────────────────────────────────────

chargeRoutes.post('/simulate', async (c) => {
  requireAdminOrAgent(c.get('session'));
  const svc = getSvc(c);
  const body = await c.req.json();
  const parsed = chargeSimulationSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid simulation input', { issues: parsed.error.flatten().fieldErrors });
  }
  const { chargeDefinitionIds, ...ctx } = parsed.data;
  const result = await svc.simulate(ctx as any, chargeDefinitionIds);
  return c.json(success(result));
});

// ── Booking Charges ───────────────────────────────────────────────────────────

chargeRoutes.get('/bookings/:bookingId', async (c) => {
  const session = c.get('session');
  requireAdminOrAgent(session);
  const svc = getSvc(c);
  const lines = await svc.getBookingChargeBreakdown(c.req.param('bookingId'));
  return c.json(success(lines));
});

// ── Payout / Refund Charges ───────────────────────────────────────────────────

chargeRoutes.get('/payouts/:payoutId', async (c) => {
  requireAdminOrAgent(c.get('session'));
  const svc = getSvc(c);
  const lines = await svc.getPayoutChargeLines(c.req.param('payoutId'));
  return c.json(success(lines));
});

chargeRoutes.get('/refunds/:refundId', async (c) => {
  requireAdminOrAgent(c.get('session'));
  const svc = getSvc(c);
  const lines = await svc.getRefundChargeLines(c.req.param('refundId'));
  return c.json(success(lines));
});

// ── Reference Data ────────────────────────────────────────────────────────────

chargeRoutes.get('/jurisdiction/:country', async (c) => {
  const svc = getSvc(c);
  const country = c.req.param('country').toUpperCase();
  const region = c.req.query('region');
  const profile = await svc.getJurisdictionProfile(country, region);
  if (!profile) throw new AppError('NOT_FOUND', 'Jurisdiction profile not found', 404);
  return c.json(success(profile));
});

chargeRoutes.get('/tax-codes/:country', async (c) => {
  const svc = getSvc(c);
  const country = c.req.param('country').toUpperCase();
  const codes = await svc.getTaxCodes(country);
  return c.json(success(codes));
});
