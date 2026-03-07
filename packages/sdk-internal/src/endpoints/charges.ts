import type { FelixApiClient } from '../client.js';
import type {
  ChargeBreakdown,
  ChargeSimulationResponse,
} from '@felix-travel/charges';

export function chargesEndpoints(client: FelixApiClient) {
  return {
    /** List all charge definitions */
    listDefinitions: () =>
      client.get<any[]>('/v1/charges/definitions'),

    /** Get a single charge definition */
    getDefinition: (id: string) =>
      client.get<any>(`/v1/charges/definitions/${id}`),

    /** Create a charge definition (admin only) */
    createDefinition: (body: unknown) =>
      client.post<any>('/v1/charges/definitions', body),

    /** Update a charge definition (admin only) */
    updateDefinition: (id: string, body: unknown) =>
      client.patch<any>(`/v1/charges/definitions/${id}`, body),

    /** Create a rule set for a charge definition */
    createRuleSet: (body: unknown) =>
      client.post<any>('/v1/charges/rule-sets', body),

    /** Create a charge rule within a rule set */
    createRule: (body: unknown) =>
      client.post<any>('/v1/charges/rules', body),

    /** Update a charge rule (rate change with audit trail) */
    updateRule: (id: string, body: unknown) =>
      client.patch<any>(`/v1/charges/rules/${id}`, body),

    /** Add a dependency between two charge definitions */
    addDependency: (body: unknown) =>
      client.post<any>('/v1/charges/dependencies', body),

    /** Simulate charge calculation (dry-run, admin/agent) */
    simulate: (body: unknown) =>
      client.post<ChargeSimulationResponse>('/v1/charges/simulate', body),

    /** Get computed charge lines for a booking */
    getBookingChargeLines: (bookingId: string) =>
      client.get<any[]>(`/v1/charges/bookings/${bookingId}`),

    /** Get charge deductions for a payout */
    getPayoutChargeLines: (payoutId: string) =>
      client.get<any[]>(`/v1/charges/payouts/${payoutId}`),

    /** Get charge reversals for a refund */
    getRefundChargeLines: (refundId: string) =>
      client.get<any[]>(`/v1/charges/refunds/${refundId}`),

    /** Get jurisdiction profile for a country */
    getJurisdictionProfile: (country: string, region?: string) =>
      client.get<any>(`/v1/charges/jurisdiction/${country}`, region ? { region } : undefined),

    /** List tax codes for a country */
    getTaxCodes: (country: string) =>
      client.get<any[]>(`/v1/charges/tax-codes/${country}`),
  };
}
