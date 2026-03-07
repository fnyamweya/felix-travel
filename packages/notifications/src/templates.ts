/**
 * Message templates — keyed by template name with placeholder interpolation.
 */

export type TemplateName =
    | 'login_otp'
    | 'phone_verify_otp'
    | 'step_up_otp'
    | 'mfa_sms_otp'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'payment_received'
    | 'refund_initiated'
    | 'refund_completed'
    | 'payout_initiated'
    | 'payout_completed'
    | 'approval_required'
    | 'approval_approved'
    | 'approval_rejected'
    | 'password_reset'
    | 'account_locked';

interface Template {
    sms: string;
    subject?: string;
    email?: string;
}

const TEMPLATES: Record<TemplateName, Template> = {
    login_otp: {
        sms: 'Your Felix Travel login code is {{code}}. Valid for {{minutes}} minutes. Do not share this code.',
    },
    phone_verify_otp: {
        sms: 'Your Felix Travel verification code is {{code}}. Valid for {{minutes}} minutes.',
    },
    step_up_otp: {
        sms: 'Your Felix Travel step-up code is {{code}}. Valid for {{minutes}} minutes. Action: {{action}}.',
    },
    mfa_sms_otp: {
        sms: 'Your Felix Travel authentication code is {{code}}. Valid for 5 minutes.',
    },
    booking_confirmed: {
        sms: 'Your booking {{bookingRef}} has been confirmed! Check your email for details.',
        subject: 'Booking Confirmed - {{bookingRef}}',
        email: 'Hi {{name}}, your booking {{bookingRef}} for {{listing}} on {{date}} has been confirmed. Amount: {{currency}} {{amount}}.',
    },
    booking_cancelled: {
        sms: 'Your booking {{bookingRef}} has been cancelled. A refund will be processed shortly.',
        subject: 'Booking Cancelled - {{bookingRef}}',
        email: 'Hi {{name}}, your booking {{bookingRef}} has been cancelled.',
    },
    payment_received: {
        sms: 'Payment of {{currency}} {{amount}} received for booking {{bookingRef}}. Thank you!',
        subject: 'Payment Received - {{bookingRef}}',
        email: 'Hi {{name}}, we have received your payment of {{currency}} {{amount}} for booking {{bookingRef}}.',
    },
    refund_initiated: {
        sms: 'A refund of {{currency}} {{amount}} for booking {{bookingRef}} has been initiated.',
        subject: 'Refund Initiated - {{bookingRef}}',
        email: 'Hi {{name}}, a refund of {{currency}} {{amount}} for booking {{bookingRef}} has been initiated. Please allow 5-10 business days.',
    },
    refund_completed: {
        sms: 'Your refund of {{currency}} {{amount}} for booking {{bookingRef}} has been completed.',
        subject: 'Refund Completed - {{bookingRef}}',
        email: 'Hi {{name}}, your refund of {{currency}} {{amount}} for booking {{bookingRef}} has been deposited to your account.',
    },
    payout_initiated: {
        sms: 'Payout of {{currency}} {{amount}} has been initiated to your account.',
        subject: 'Payout Initiated',
        email: 'Hi {{name}}, a payout of {{currency}} {{amount}} has been initiated to your account. Reference: {{payoutRef}}.',
    },
    payout_completed: {
        sms: 'Payout of {{currency}} {{amount}} (ref: {{payoutRef}}) has been completed.',
        subject: 'Payout Completed',
        email: 'Hi {{name}}, your payout of {{currency}} {{amount}} (reference: {{payoutRef}}) has been completed.',
    },
    approval_required: {
        sms: 'Approval required: {{action}} for {{resource}}. Login to review.',
        subject: 'Approval Required - {{action}}',
        email: 'Hi {{name}}, an action "{{action}}" requires your approval. Resource: {{resource}}. Please log in to review and approve or reject.',
    },
    approval_approved: {
        sms: 'Your request for {{action}} has been approved.',
        subject: 'Request Approved - {{action}}',
        email: 'Hi {{name}}, your request for "{{action}}" on {{resource}} has been approved by {{approver}}.',
    },
    approval_rejected: {
        sms: 'Your request for {{action}} has been rejected. Reason: {{reason}}.',
        subject: 'Request Rejected - {{action}}',
        email: 'Hi {{name}}, your request for "{{action}}" on {{resource}} has been rejected. Reason: {{reason}}.',
    },
    password_reset: {
        sms: 'Your Felix Travel password reset code is {{code}}. Valid for {{minutes}} minutes.',
        subject: 'Password Reset',
        email: 'Hi {{name}}, use code {{code}} to reset your password. Valid for {{minutes}} minutes.',
    },
    account_locked: {
        sms: 'Your Felix Travel account has been temporarily locked due to multiple failed login attempts. Contact support.',
        subject: 'Account Locked',
        email: 'Hi {{name}}, your account has been temporarily locked due to suspicious activity. If this was not you, please contact support immediately.',
    },
};

/**
 * Render a template with the provided variables.
 */
function render(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export const templates = {
    sms(name: TemplateName, vars: Record<string, string>): string {
        return render(TEMPLATES[name].sms, vars);
    },

    emailSubject(name: TemplateName, vars: Record<string, string>): string | null {
        const template = TEMPLATES[name].subject;
        return template ? render(template, vars) : null;
    },

    emailBody(name: TemplateName, vars: Record<string, string>): string | null {
        const template = TEMPLATES[name].email;
        return template ? render(template, vars) : null;
    },
};
