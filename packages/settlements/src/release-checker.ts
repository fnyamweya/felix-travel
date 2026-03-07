import type { ReleaseEligibility } from './types.js';

export interface ReleaseCheckInput {
  bookingId: string;
  status: string;
  serviceDate: string; // ISO date YYYY-MM-DD
  confirmedAt: string | null; // ISO datetime
  paymentSucceededAt: string | null;
}

export interface ReleaseCheckOptions {
  /** Number of days after service date before settlement is released. Default: 3 */
  settlementDelayDays?: number;
  /** Current date override for testing. Default: today */
  asOfDate?: string;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function checkReleaseEligibility(
  booking: ReleaseCheckInput,
  opts?: ReleaseCheckOptions,
): ReleaseEligibility {
  const settlementDelayDays = opts?.settlementDelayDays ?? 3;
  const asOfDate = opts?.asOfDate ?? todayIso();

  // Step 1: Booking must be confirmed
  if (booking.status !== 'confirmed') {
    return {
      eligible: false,
      reason: 'Booking is not confirmed',
    };
  }

  // Step 2: Payment must have been received
  if (booking.paymentSucceededAt === null) {
    return {
      eligible: false,
      reason: 'Payment has not been received',
    };
  }

  // Step 3: Compute releaseDate
  const releaseDate = addDays(booking.serviceDate, settlementDelayDays);

  // Step 4: Check if settlement delay period has elapsed
  if (asOfDate < releaseDate) {
    return {
      eligible: false,
      reason: 'Settlement delay period has not elapsed',
      eligibleFrom: releaseDate,
    };
  }

  // Step 5: Eligible
  return {
    eligible: true,
  };
}
