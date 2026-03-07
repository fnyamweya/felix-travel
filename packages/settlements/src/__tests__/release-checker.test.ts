import { describe, it, expect } from 'vitest';
import { checkReleaseEligibility } from '../release-checker.js';
import type { ReleaseCheckInput } from '../release-checker.js';

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe('checkReleaseEligibility', () => {
  it('eligible when all conditions met', () => {
    const booking: ReleaseCheckInput = {
      bookingId: 'bk_001',
      status: 'confirmed',
      serviceDate: daysAgo(4),
      confirmedAt: `${daysAgo(5)}T00:00:00Z`,
      paymentSucceededAt: `${daysAgo(5)}T00:00:00Z`,
    };

    const result = checkReleaseEligibility(booking);

    expect(result.eligible).toBe(true);
  });

  it('not eligible when status is not confirmed', () => {
    const booking: ReleaseCheckInput = {
      bookingId: 'bk_002',
      status: 'draft',
      serviceDate: daysAgo(4),
      confirmedAt: null,
      paymentSucceededAt: null,
    };

    const result = checkReleaseEligibility(booking);

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('not confirmed');
  });

  it('not eligible when payment not received', () => {
    const booking: ReleaseCheckInput = {
      bookingId: 'bk_003',
      status: 'confirmed',
      serviceDate: daysAgo(4),
      confirmedAt: `${daysAgo(5)}T00:00:00Z`,
      paymentSucceededAt: null,
    };

    const result = checkReleaseEligibility(booking);

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Payment');
  });

  it('not eligible before settlement delay elapsed', () => {
    const booking: ReleaseCheckInput = {
      bookingId: 'bk_004',
      status: 'confirmed',
      serviceDate: today,
      confirmedAt: `${today}T00:00:00Z`,
      paymentSucceededAt: `${today}T00:00:00Z`,
    };

    const result = checkReleaseEligibility(booking);

    expect(result.eligible).toBe(false);
    expect(result.eligibleFrom).toBe(daysFromNow(3));
  });

  it('respects custom settlementDelayDays', () => {
    const booking: ReleaseCheckInput = {
      bookingId: 'bk_005',
      status: 'confirmed',
      serviceDate: yesterday,
      confirmedAt: `${yesterday}T00:00:00Z`,
      paymentSucceededAt: `${yesterday}T00:00:00Z`,
    };

    const result = checkReleaseEligibility(booking, { settlementDelayDays: 0 });

    expect(result.eligible).toBe(true);
  });
});
