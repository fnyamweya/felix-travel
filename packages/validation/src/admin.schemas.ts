import { z } from 'zod';

export const manualLedgerAdjustmentSchema = z.object({
  description: z.string().min(1).max(500),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(z.object({
    accountCode: z.string().min(1),
    providerId: z.string().optional(),
    debitAmount: z.number().int().min(0),
    creditAmount: z.number().int().min(0),
    currencyCode: z.string().length(3),
    memo: z.string().max(200).optional(),
  })).min(2),
  idempotencyKey: z.string().min(1),
}).refine((data) => {
  const totalDebits = data.lines.reduce((s, l) => s + l.debitAmount, 0);
  const totalCredits = data.lines.reduce((s, l) => s + l.creditAmount, 0);
  return totalDebits === totalCredits;
}, { message: 'Ledger entry must balance: total debits must equal total credits' });

export const resolveDiscrepancySchema = z.object({
  resolution: z.string().min(1).max(500),
});

export const reconcilePaymentsSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
