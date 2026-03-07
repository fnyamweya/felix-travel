import type { DateTimeString, MinorCurrencyAmount } from './common.js';

export type BookingStatus =
  | 'draft'
  | 'quoted'
  | 'pending_payment'
  | 'payment_processing'
  | 'paid'
  | 'confirmed'
  | 'partially_refunded'
  | 'refunded'
  | 'cancelled'
  | 'failed'
  | 'payout_pending'
  | 'payout_processing'
  | 'payout_completed';

export interface Booking {
  id: string;
  reference: string;
  customerId: string;
  agentId: string | null;
  providerId: string;
  listingId: string;
  status: BookingStatus;
  serviceDate: string;
  serviceDateEnd: string | null;
  guestCount: number;
  subtotalAmount: MinorCurrencyAmount;
  commissionAmount: MinorCurrencyAmount;
  taxAmount: MinorCurrencyAmount;
  totalAmount: MinorCurrencyAmount;
  currencyCode: string;
  specialRequests: string | null;
  internalNotes: string | null;
  cancellationReason: string | null;
  expiresAt: DateTimeString | null;
  confirmedAt: DateTimeString | null;
  cancelledAt: DateTimeString | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
  items: BookingItem[];
  travelers: Traveler[];
}

export interface BookingItem {
  id: string;
  bookingId: string;
  listingId: string;
  pricingRuleId: string | null;
  description: string;
  quantity: number;
  unitPrice: MinorCurrencyAmount;
  totalPrice: MinorCurrencyAmount;
  providerId: string;
  providerPayableAmount: MinorCurrencyAmount;
  platformCommissionAmount: MinorCurrencyAmount;
}

export interface Traveler {
  id: string;
  bookingId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  passportNumber: string | null;
  nationality: string | null;
  isPrimary: boolean;
}

export interface BookingQuote {
  id: string;
  customerId: string;
  listingId: string;
  serviceDate: string;
  guestCount: number;
  items: BookingQuoteItem[];
  subtotalAmount: MinorCurrencyAmount;
  commissionAmount: MinorCurrencyAmount;
  taxAmount: MinorCurrencyAmount;
  totalAmount: MinorCurrencyAmount;
  currencyCode: string;
  expiresAt: DateTimeString;
}

export interface BookingQuoteItem {
  pricingRuleId: string;
  description: string;
  quantity: number;
  unitPrice: MinorCurrencyAmount;
  totalPrice: MinorCurrencyAmount;
}
