/**
 * Tingg Local Payout operations.
 * Used for same-country mobile money payouts (e.g. M-Pesa Kenya).
 *
 * Consumed by: PayoutService.issuePayout (when provider account is local mobile money)
 */
import type {
  TinggNetworkLookupRequest,
  TinggNetworkLookupResponse,
  TinggLocalPayoutRequest,
  TinggLocalPayoutResponse,
  TinggPayoutStatusRequest,
  TinggPayoutStatusResponse,
  TinggFloatBalanceResponse,
} from '@felix-travel/types';
import type { TinggHttpClient } from '../http-client.js';
import type { TinggConfig, TinggRequestOptions } from '../types/config.js';

export class TinggLocalPayoutAdapter {
  constructor(
    private readonly http: TinggHttpClient,
    private readonly config: TinggConfig
  ) { }

  /** Look up mobile network for a given MSISDN — used before routing local payouts */
  async lookupNetwork(
    payload: TinggNetworkLookupRequest,
    opts: TinggRequestOptions
  ): Promise<TinggNetworkLookupResponse> {
    return this.http.post<TinggNetworkLookupRequest, TinggNetworkLookupResponse>(
      '/payout/network-lookup',
      payload,
      opts
    );
  }

  /** Submit a local (same-country) payout to a mobile money account */
  async postLocalPayment(
    payload: TinggLocalPayoutRequest,
    opts: TinggRequestOptions
  ): Promise<TinggLocalPayoutResponse> {
    return this.http.post<TinggLocalPayoutRequest, TinggLocalPayoutResponse>(
      '/payout/local/post',
      payload,
      opts
    );
  }

  /** Query the status of a local payout */
  async queryLocalPaymentStatus(
    payload: TinggPayoutStatusRequest,
    opts: TinggRequestOptions
  ): Promise<TinggPayoutStatusResponse> {
    return this.http.post<TinggPayoutStatusRequest, TinggPayoutStatusResponse>(
      '/payout/local/query-status',
      payload,
      opts
    );
  }

  /** Query available float balance for the payout service */
  async queryFloatBalance(opts: TinggRequestOptions): Promise<TinggFloatBalanceResponse> {
    return this.http.post(
      '/payout/float-balance',
      { serviceCode: this.config.payoutServiceCode },
      opts
    );
  }
}
