import 'server-only';

import { appConfig } from '@/config/app';

/**
 * Transactional notifications (email via Resend, WhatsApp via Cloud API).
 * Unset provider keys skip that channel (dev-safe).
 */
export const notificationsConfig = {
  companyName: appConfig.companyName,
  fromEmail: process.env.BOOKING_NOTIFICATIONS_FROM?.trim() || 'bookings@silvercarz.com',
  fromName: process.env.BOOKING_NOTIFICATIONS_FROM_NAME?.trim() || appConfig.companyName,
  replyTo: process.env.BOOKING_NOTIFICATIONS_REPLY_TO?.trim() || undefined,
  /** Public site origin for links in messages, e.g. https://silvercarz.com */
  appOrigin: process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || '',
  whatsappGraphVersion: process.env.WHATSAPP_GRAPH_VERSION?.trim() || 'v21.0',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '',
  whatsappTemplateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim() || '',
} as const;

export function isEmailNotificationsEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function isWhatsAppNotificationsEnabled(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
}

export function isWhatsAppDryRun(): boolean {
  return process.env.WHATSAPP_DRY_RUN?.trim() === 'true';
}

/** When true, send session `text` messages instead of templates (24h window / sandbox). */
export function isWhatsAppTextFallbackEnabled(): boolean {
  return process.env.WHATSAPP_SEND_TEXT_FALLBACK?.trim() === 'true';
}

export function getWhatsAppAccessToken(): string | null {
  return process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
}

export function getWhatsAppAppSecret(): string | null {
  return process.env.WHATSAPP_APP_SECRET?.trim() || null;
}

export function getNotificationCronSecret(): string | null {
  return process.env.NOTIFICATION_CRON_SECRET?.trim() || null;
}
