import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success: 'border-transparent bg-emerald-100 text-emerald-900',
        warning: 'border-transparent bg-amber-100 text-amber-900',
        info: 'border-transparent bg-sky-100 text-sky-900',
        neutral: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function BookingStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeProps['variant']> = {
    draft: 'neutral',
    quoted: 'info',
    pending_payment: 'warning',
    payment_processing: 'info',
    paid: 'info',
    confirmed: 'success',
    partially_refunded: 'warning',
    refunded: 'neutral',
    cancelled: 'destructive',
    failed: 'destructive',
    payout_pending: 'warning',
    payout_processing: 'info',
    payout_completed: 'success',
  };
  return <Badge variant={variantMap[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeProps['variant']> = {
    initiated: 'neutral',
    pending_customer_action: 'warning',
    pending_provider: 'warning',
    processing: 'info',
    succeeded: 'success',
    partially_refunded: 'warning',
    refunded: 'neutral',
    failed: 'destructive',
    reversed: 'destructive',
  };
  return <Badge variant={variantMap[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}
