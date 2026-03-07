import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-50 text-gray-600 border border-gray-200',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variantClasses[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}

/** Map booking status to badge variant */
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
    cancelled: 'error',
    failed: 'error',
    payout_pending: 'warning',
    payout_processing: 'info',
    payout_completed: 'success',
  };
  return <Badge variant={variantMap[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}

/** Map payment status to badge variant */
export function PaymentStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeProps['variant']> = {
    initiated: 'neutral',
    pending_customer_action: 'warning',
    pending_provider: 'warning',
    processing: 'info',
    succeeded: 'success',
    partially_refunded: 'warning',
    refunded: 'neutral',
    failed: 'error',
    reversed: 'error',
  };
  return <Badge variant={variantMap[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>;
}
