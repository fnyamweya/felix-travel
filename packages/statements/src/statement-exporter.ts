import type { ProviderStatement, PlatformStatement } from './types.js';

// ─── CSV Export ───────────────────────────────────────────────────────────────

/**
 * Render a statement as a CSV string.
 *
 * Column order: date, type, reference, description, debit, credit, balance, currency
 *
 * A summary footer row is appended with period totals.
 */
export function exportToCSV(statement: ProviderStatement | PlatformStatement): string {
  const header = 'date,type,reference,description,debit,credit,balance,currency';

  const rows = statement.lineItems.map((item) =>
    [
      item.date,
      item.type,
      item.referenceId,
      escapeCSVField(item.description),
      String(item.debitAmount),
      String(item.creditAmount),
      String(item.runningBalance),
      item.currencyCode,
    ].join(','),
  );

  // Summary footer
  const totalDebit = statement.lineItems.reduce((sum, l) => sum + l.debitAmount, 0);
  const totalCredit = statement.lineItems.reduce((sum, l) => sum + l.creditAmount, 0);
  const lastItem = statement.lineItems[statement.lineItems.length - 1];
  const finalBalance = lastItem?.runningBalance ?? 0;

  const footer = [
    `${statement.period.from}/${statement.period.to}`,
    'TOTALS',
    '',
    'Summary',
    String(totalDebit),
    String(totalCredit),
    String(finalBalance),
    statement.currencyCode,
  ].join(',');

  return [header, ...rows, footer].join('\n');
}

// ─── JSON Export ──────────────────────────────────────────────────────────────

/**
 * Render a statement as a pretty-printed JSON string.
 */
export function exportToJSON(statement: ProviderStatement | PlatformStatement): string {
  return JSON.stringify(statement, null, 2);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
