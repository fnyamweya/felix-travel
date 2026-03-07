/**
 * Tingg Remittance operations.
 * Used for cross-border payouts when FEATURE_ENABLE_CROSS_BORDER_PAYOUTS=true
 * and provider's account currency differs from platform currency.
 *
 * Consumed by: PayoutService.issuePayout (when provider account is remittance type)
 */
import type {
  TinggRemittanceAccountValidationRequest,
  TinggRemittanceAccountValidationResponse,
  TinggRemittanceRequest,
  TinggRemittanceResponse,
  TinggRemittanceStatusRequest,
  TinggPayoutStatusResponse,
} from '@felix-travel/types';
import type { TinggHttpClient } from '../http-client.js';
import type { TinggRequestOptions } from '../types/config.js';

export class TinggRemittanceAdapter {
  constructor(private readonly http: TinggHttpClient) { }

  /** Validate a remittance beneficiary account before initiating payout */
  async validateRemittanceAccount(
    payload: TinggRemittanceAccountValidationRequest,
    opts: TinggRequestOptions
  ): Promise<TinggRemittanceAccountValidationResponse> {
    return this.http.post<TinggRemittanceAccountValidationRequest, TinggRemittanceAccountValidationResponse>(
      '/payout/remittance/validate-account',
      payload,
      opts
    );
  }

  /** Initiate a cross-border remittance payout */
  async initiateRemittance(
    payload: TinggRemittanceRequest,
    opts: TinggRequestOptions
  ): Promise<TinggRemittanceResponse> {
    return this.http.post<TinggRemittanceRequest, TinggRemittanceResponse>(
      '/payout/remittance/initiate',
      payload,
      opts
    );
  }

  /** Query the status of a remittance payout */
  async queryRemittanceStatus(
    payload: TinggRemittanceStatusRequest,
    opts: TinggRequestOptions
  ): Promise<TinggPayoutStatusResponse> {
    return this.http.post<TinggRemittanceStatusRequest, TinggPayoutStatusResponse>(
      '/payout/remittance/query-status',
      payload,
      opts
    );
  }
}
