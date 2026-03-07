import type { DateTimeString } from './common.js';
import type { ProviderWebhookEvent } from './providers.js';

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: ProviderWebhookEvent;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt: DateTimeString | null;
  nextRetryAt: DateTimeString | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  createdAt: DateTimeString;
}

export interface TinggCheckoutCallback {
  checkoutRequestID: string;
  merchantTransactionID: string;
  requestStatus: string;
  requestStatusCode: string;
  requestStatusDescription: string;
  payerClientCode: string;
  payerTransactionID: string | null;
  MSISDN: string;
  amount: number;
  currencyCode: string;
  serviceCode: string;
  paymentOption: string | null;
}

export interface TinggPayoutCallback {
  paymentRef: string;
  merchantRef: string;
  transactionRef: string | null;
  requestStatus: string;
  requestStatusCode: string;
  requestStatusDescription: string;
  amount: number;
  currencyCode: string;
  creditPartyIdentifier: string;
  creditPartyNetwork: string | null;
}
