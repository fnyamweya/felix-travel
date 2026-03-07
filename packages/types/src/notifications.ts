export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'refund_initiated'
  | 'refund_succeeded'
  | 'payout_initiated'
  | 'payout_completed'
  | 'payout_failed'
  | 'invite_received'
  | 'magic_link'
  | 'password_reset'
  | 'otp';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  metadata?: Record<string, string>;
}
