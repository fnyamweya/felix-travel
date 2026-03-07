
interface MoneyDisplayProps {
  amount: number; // minor units
  currency?: string;
  className?: string;
}

/** Format minor currency units to display string */
export function formatMoney(amount: number, currency = 'KES'): string {
  const major = amount / 100;
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(major);
}

export function MoneyDisplay({ amount, currency = 'KES', className }: MoneyDisplayProps) {
  return <span className={className}>{formatMoney(amount, currency)}</span>;
}
