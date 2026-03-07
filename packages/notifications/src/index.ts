/**
 * Notifications package — SMS and email notification delivery via
 * Tingg Engage (SMS) and templated message generation.
 */
export { createSmsNotifier, type SmsNotifier, type SmsNotifierDeps } from './sms-notifier.js';
export { createNotificationService, type NotificationService } from './notification-service.js';
export { templates, type TemplateName } from './templates.js';
