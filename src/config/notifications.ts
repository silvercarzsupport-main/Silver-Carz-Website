import 'server-only';

import { appConfig } from '@/config/app';

/**
 * Transactional email configuration (Resend).
 * When RESEND_API_KEY is unset, notifications are skipped (dev-safe).
 */
export const notificationsConfig = {
  companyName: appConfig.companyName,
  fromEmail: process.env.BOOKING_NOTIFICATIONS_FROM?.trim() || 'bookings@silvercarz.com',
  fromName: process.env.BOOKING_NOTIFICATIONS_FROM_NAME?.trim() || appConfig.companyName,
  replyTo: process.env.BOOKING_NOTIFICATIONS_REPLY_TO?.trim() || undefined,
  /** Public site origin for links in emails, e.g. https://silvercarz.com */
  appOrigin: process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || '',
} as const;

export function isEmailNotificationsEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
