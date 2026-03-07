/**
 * Tingg Collections — Checkout & Charge operations.
 *
 * Consumed by: PaymentService.initiateCheckout, PaymentService.initiateCharge,
 * PaymentService.validateCharge, PaymentService.queryStatus, PaymentService.acknowledgePayment
 */
import type {
  TinggCheckoutRequest,
  TinggCheckoutResponse,
  TinggChargeRequest,
  TinggChargeResponse,
  TinggQueryStatusRequest,
  TinggQueryStatusResponse,
  TinggAcknowledgeRequest,
  TinggValidateChargeRequest,
} from '@felix-travel/types';
import type { TinggHttpClient } from '../http-client.js';
import type { TinggRequestOptions } from '../types/config.js';

export class TinggCheckoutAdapter {
  constructor(private readonly http: TinggHttpClient) { }

  /** Initiate a checkout request — creates a payment session on Tingg */
  async initiateCheckout(
    payload: TinggCheckoutRequest,
    opts: TinggRequestOptions
  ): Promise<TinggCheckoutResponse> {
    return this.http.post<TinggCheckoutRequest, TinggCheckoutResponse>(
      '/checkout/initiate',
      payload,
      opts
    );
  }

  /** Initiate a charge against an existing checkout session */
  async initiateCharge(
    payload: TinggChargeRequest,
    opts: TinggRequestOptions
  ): Promise<TinggChargeResponse> {
    return this.http.post<TinggChargeRequest, TinggChargeResponse>(
      '/checkout/charge',
      payload,
      opts
    );
  }

  /** Initiate checkout and charge in a single call (combined flow) */
  async initiateCheckoutAndCharge(
    payload: TinggCheckoutRequest & TinggChargeRequest,
    opts: TinggRequestOptions
  ): Promise<TinggChargeResponse> {
    return this.http.post<TinggCheckoutRequest & TinggChargeRequest, TinggChargeResponse>(
      '/checkout/initiate-and-charge',
      payload,
      opts
    );
  }

  /** Validate a charge using OTP provided by the customer */
  async validateCharge(
    payload: TinggValidateChargeRequest,
    opts: TinggRequestOptions
  ): Promise<{ results: { requestStatus: string; requestStatusCode: string; requestStatusDescription: string } }> {
    return this.http.post(
      '/checkout/validate-charge',
      payload,
      opts
    );
  }

  /** Query the current status of a checkout request */
  async queryStatus(
    payload: TinggQueryStatusRequest,
    opts: TinggRequestOptions
  ): Promise<TinggQueryStatusResponse> {
    return this.http.post<TinggQueryStatusRequest, TinggQueryStatusResponse>(
      '/checkout/query-status',
      payload,
      opts
    );
  }

  /** Acknowledge receipt of a successful payment — required by some Tingg integration models */
  async acknowledgePayment(
    payload: TinggAcknowledgeRequest,
    opts: TinggRequestOptions
  ): Promise<{ results: { requestStatus: string; requestStatusCode: string } }> {
    return this.http.post(
      '/checkout/acknowledge',
      payload,
      opts
    );
  }
}
