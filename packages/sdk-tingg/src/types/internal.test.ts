import { describe, it, expect } from 'vitest';
import { mapTinggPaymentStatus, mapTinggPayoutStatus, shouldAcknowledgePayment } from './internal.js';

describe('Tingg status mapping', () => {
  it('maps 178 to succeeded for payments', () => {
    expect(mapTinggPaymentStatus('178')).toBe('succeeded');
  });

  it('maps 188 to pending_customer_action for payments', () => {
    expect(mapTinggPaymentStatus('188')).toBe('pending_customer_action');
  });

  it('maps 180 to failed for payments', () => {
    expect(mapTinggPaymentStatus('180')).toBe('failed');
  });

  it('maps unknown code to processing (safe default)', () => {
    expect(mapTinggPaymentStatus('999')).toBe('processing');
  });

  it('maps 178 to succeeded for payouts', () => {
    expect(mapTinggPayoutStatus('178')).toBe('succeeded');
  });

  it('only acknowledges successful payments (178)', () => {
    expect(shouldAcknowledgePayment('178')).toBe(true);
    expect(shouldAcknowledgePayment('188')).toBe(false);
    expect(shouldAcknowledgePayment('180')).toBe(false);
  });
});
