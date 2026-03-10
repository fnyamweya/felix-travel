import { ApiError } from '@felix-travel/sdk-internal';

export function formatMoney(amount: number | null | undefined, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format((amount ?? 0) / 100);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function humanizeToken(value: string) {
  return value.replace(/_/g, ' ');
}

export function titleizeToken(value: string) {
  return humanizeToken(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const issues = error.details?.issues;
    if (issues && typeof issues === 'object') {
      const firstEntry = Object.entries(issues as Record<string, unknown[]>).find(([, value]) => Array.isArray(value) && value.length > 0);
      if (firstEntry) return String(firstEntry[1][0]);
    }
    return error.message;
  }

  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

export function toOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  return Number(value);
}

export function toOptionalTrimmed(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
