import { describe, it, expect } from 'vitest';
import { calculateSettlement } from '../settlement-engine.js';
import type { SettlementInput } from '../settlement-engine.js';

describe('calculateSettlement', () => {
  it('returns netPayable = gross - provider-payer deductions', () => {
    const input: SettlementInput = {
      bookingId: 'bk_001',
      providerId: 'prv_001',
      grossAmount: 100_000,
      currencyCode: 'KES',
      chargeLines: [
        {
          chargeDefinitionId: 'cd_1',
          code: 'PLATFORM_COMMISSION',
          name: 'Platform Commission',
          chargeAmount: 10_000,
          payer: 'provider',
          beneficiary: 'platform',
        },
        {
          chargeDefinitionId: 'cd_2',
          code: 'VAT_ON_COMMISSION',
          name: 'VAT on Commission',
          chargeAmount: 5_000,
          payer: 'provider',
          beneficiary: 'government',
        },
        {
          chargeDefinitionId: 'cd_3',
          code: 'BOOKING_FEE',
          name: 'Booking Fee',
          chargeAmount: 2_500,
          payer: 'customer',
          beneficiary: 'platform',
        },
        {
          chargeDefinitionId: 'cd_4',
          code: 'TOURISM_LEVY',
          name: 'Tourism Levy',
          chargeAmount: 1_000,
          payer: 'customer',
          beneficiary: 'government',
        },
        {
          chargeDefinitionId: 'cd_5',
          code: 'SERVICE_FEE',
          name: 'Service Fee',
          chargeAmount: 3_000,
          payer: 'customer',
          beneficiary: 'platform',
        },
      ],
    };

    const result = calculateSettlement(input);

    expect(result.totalDeductions).toBe(15_000);
    expect(result.netPayable).toBe(85_000);
  });

  it('uses defaultCommissionBps when no charge lines', () => {
    const input: SettlementInput = {
      bookingId: 'bk_002',
      providerId: 'prv_001',
      grossAmount: 100_000,
      currencyCode: 'KES',
      chargeLines: [],
      defaultCommissionBps: 1000, // 10%
    };

    const result = calculateSettlement(input);

    expect(result.netPayable).toBe(90_000);
    expect(result.deductions.length).toBe(1);
    expect(result.deductions[0]!.code).toBe('PLATFORM_COMMISSION');
  });

  it('floors netPayable at 0 when deductions exceed gross', () => {
    const input: SettlementInput = {
      bookingId: 'bk_003',
      providerId: 'prv_001',
      grossAmount: 5_000,
      currencyCode: 'KES',
      chargeLines: [
        {
          chargeDefinitionId: 'cd_1',
          code: 'PLATFORM_COMMISSION',
          name: 'Platform Commission',
          chargeAmount: 10_000,
          payer: 'provider',
          beneficiary: 'platform',
        },
      ],
    };

    const result = calculateSettlement(input);

    expect(result.netPayable).toBe(0);
  });

  it('builds ledger postings for charge lines with account codes', () => {
    const input: SettlementInput = {
      bookingId: 'bk_004',
      providerId: 'prv_001',
      grossAmount: 100_000,
      currencyCode: 'KES',
      chargeLines: [
        {
          chargeDefinitionId: 'cd_1',
          code: 'PLATFORM_COMMISSION',
          name: 'Platform Commission',
          chargeAmount: 5_000,
          payer: 'provider',
          beneficiary: 'platform',
          ledgerDebitAccountCode: '2000',
          ledgerCreditAccountCode: '4000',
        },
      ],
    };

    const result = calculateSettlement(input);

    const posting = result.ledgerPostings.find(
      (p) => p.debitAccountCode === '2000' && p.creditAccountCode === '4000',
    );
    expect(posting).toBeDefined();
  });

  it('empty charge lines with no defaultCommissionBps → zero deductions', () => {
    const input: SettlementInput = {
      bookingId: 'bk_005',
      providerId: 'prv_001',
      grossAmount: 50_000,
      currencyCode: 'KES',
      chargeLines: [],
    };

    const result = calculateSettlement(input);

    expect(result.totalDeductions).toBe(0);
    expect(result.netPayable).toBe(50_000);
  });
});
