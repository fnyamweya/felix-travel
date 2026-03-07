import type { DateTimeString } from './common.js';

export interface ServiceProvider {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  email: string;
  phone: string | null;
  countryCode: string;
  currencyCode: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  isVerified: boolean;
  /** Reserve balance tracks amount owed to platform after post-payout refunds (minor units) */
  reserveBalanceAmount: number;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface ProviderPayoutAccount {
  id: string;
  providerId: string;
  accountType: 'mobile_money' | 'bank_account' | 'remittance';
  accountNumber: string;
  accountName: string;
  networkCode: string;
  countryCode: string;
  currencyCode: string;
  isDefault: boolean;
  isVerified: boolean;
  /** Snapshot of Tingg validation result — archived for audit */
  validationSnapshot: Record<string, unknown> | null;
  createdAt: DateTimeString;
}

export interface ProviderCallbackSubscription {
  id: string;
  providerId: string;
  url: string;
  events: ProviderWebhookEvent[];
  isActive: boolean;
  /** Last 4 chars of signing secret — full secret never returned after creation */
  secretHint: string;
  maxRetries: number;
  timeoutMs: number;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export type ProviderWebhookEvent =
  | 'booking.created'
  | 'booking.updated'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'refund.initiated'
  | 'refund.succeeded'
  | 'payout.pending'
  | 'payout.processing'
  | 'payout.completed'
  | 'payout.failed';
