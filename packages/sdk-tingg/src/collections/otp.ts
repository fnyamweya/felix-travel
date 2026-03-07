import type {
  TinggOtpRequest,
  TinggOtpResponse,
  TinggOtpValidateRequest,
} from '@felix-travel/types';
import type { TinggHttpClient } from '../http-client.js';
import type { TinggRequestOptions } from '../types/config.js';

export class TinggOtpAdapter {
  constructor(private readonly http: TinggHttpClient) { }

  /** Send OTP to customer's phone for payment confirmation */
  async sendOtp(payload: TinggOtpRequest, opts: TinggRequestOptions): Promise<TinggOtpResponse> {
    return this.http.post<TinggOtpRequest, TinggOtpResponse>('/checkout/send-otp', payload, opts);
  }

  /** Validate OTP entered by customer */
  async validateOtp(
    payload: TinggOtpValidateRequest,
    opts: TinggRequestOptions
  ): Promise<TinggOtpResponse> {
    return this.http.post<TinggOtpValidateRequest, TinggOtpResponse>(
      '/checkout/validate-otp',
      payload,
      opts
    );
  }
}
