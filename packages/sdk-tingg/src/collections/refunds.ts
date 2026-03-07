import type { TinggRefundRequest, TinggRefundResponse } from '@felix-travel/types';
import type { TinggHttpClient } from '../http-client.js';
import type { TinggRequestOptions } from '../types/config.js';

export class TinggRefundAdapter {
  constructor(private readonly http: TinggHttpClient) { }

  /** Initiate a refund for a previously completed payment */
  async initiateRefund(
    payload: TinggRefundRequest,
    opts: TinggRequestOptions
  ): Promise<TinggRefundResponse> {
    return this.http.post<TinggRefundRequest, TinggRefundResponse>(
      '/checkout/refund',
      payload,
      opts
    );
  }
}
