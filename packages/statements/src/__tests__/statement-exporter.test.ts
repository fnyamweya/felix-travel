import { describe, it, expect } from 'vitest';
import { exportToCSV, exportToJSON } from '../statement-exporter.js';
import type { ProviderStatement } from '../types.js';

const mockStatement: ProviderStatement = {
  providerId: 'prv_001',
  providerName: 'Test Provider',
  period: { from: '2024-01-01', to: '2024-01-31' },
  currencyCode: 'KES',
  openingBalance: 0,
  closingBalance: 90_000,
  totalEarned: 90_000,
  totalPayouts: 0,
  totalRefunds: 0,
  lineItems: [
    {
      date: '2024-01-15',
      type: 'booking_payment',
      referenceId: 'pay_001',
      description: 'Payment for booking bk_001',
      debitAmount: 0,
      creditAmount: 90_000,
      runningBalance: 90_000,
      currencyCode: 'KES',
    },
  ],
  generatedAt: '2024-01-31T12:00:00Z',
};

describe('exportToCSV', () => {
  it('includes header row', () => {
    const csv = exportToCSV(mockStatement);

    expect(csv).toContain('date,type,reference');
  });

  it('includes one data row per line item', () => {
    const csv = exportToCSV(mockStatement);
    const lines = csv.split('\n');

    // header + 1 data row + footer = 3 lines
    expect(lines).toHaveLength(3);
  });

  it('includes TOTALS footer row', () => {
    const csv = exportToCSV(mockStatement);

    expect(csv).toContain('TOTALS');
  });
});

describe('exportToJSON', () => {
  it('returns valid JSON with providerId', () => {
    const json = exportToJSON(mockStatement);
    const parsed = JSON.parse(json) as { providerId: string };

    expect(parsed).toHaveProperty('providerId');
    expect(parsed.providerId).toBe('prv_001');
  });
});
