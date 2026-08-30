import { appConfig } from '@/config/app';
import { customerBookingDocumentsPath, customerBookingPath } from '@/constants/routes';
import type { BookingNotificationEvent } from '@/lib/notifications/events';
import { BOOKING_NOTIFICATION_EVENTS } from '@/lib/notifications/events';
import { WHATSAPP_TEMPLATE_NAMES } from '@/lib/notifications/template-names';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import type { Booking } from '@/types';
import { PAYMENT_METHOD_LABELS } from '@/types/enums';

export type BookingNotificationContext = {
  readonly event: BookingNotificationEvent;
  readonly booking: Booking;
  readonly reason?: string;
  readonly amountPaid?: number;
  readonly updateSummary?: string;
};

export type ChannelCopy = {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly templateName: string;
  readonly templateParams: readonly string[];
};

function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || '';
}

function absoluteUrl(path: string): string {
  const origin = appOrigin();
  if (!origin) {
    return path;
  }
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function greeting(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `Hi ${trimmed},` : 'Hi,';
}

function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'there';
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function dash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

/**
 * Builds email + WhatsApp template copy for a booking lifecycle event.
 * WhatsApp body parameters must match the Meta templates in `.env.example`.
 */
export function buildBookingNotificationCopy(context: BookingNotificationContext): ChannelCopy {
  const { booking, event } = context;
  const company = appConfig.companyName;
  const invoice = booking.invoice_number;
  const name = firstName(booking.customer_name);
  const pickup = formatDate(booking.delivery_date);
  const ret = formatDate(booking.return_date);
  const bookingUrl = absoluteUrl(customerBookingPath(booking.id));
  const docsUrl = absoluteUrl(customerBookingDocumentsPath(booking.id));
  const amount = formatCurrency(context.amountPaid ?? (Number(booking.booking_amount) || 0), {
    maximumFractionDigits: 0,
  });
  const total = formatCurrency(Number(booking.total_amount) || 0, { maximumFractionDigits: 0 });
  const method = booking.payment_method ? PAYMENT_METHOD_LABELS[booking.payment_method] : '—';
  const reason = dash(context.reason ?? booking.rejection_reason);
  const updateSummary = dash(context.updateSummary ?? 'Your booking details were updated.');
  const collectedAt = booking.payment_collected_at
    ? formatDateTime(booking.payment_collected_at)
    : '—';

  switch (event) {
    case BOOKING_NOTIFICATION_EVENTS.bookingRequested:
      return {
        subject: `${company} — we received your request (${invoice})`,
        text: [
          greeting(booking.customer_name),
          '',
          `We received booking request ${invoice}.`,
          `Pickup: ${pickup} · Return: ${ret}`,
          'Next: upload the required documents so our team can review your request.',
          '',
          `Upload documents: ${docsUrl}`,
        ].join('\n'),
        html: wrapHtml([
          `<p>${greeting(booking.customer_name)}</p>`,
          `<p>We received booking request <strong>${invoice}</strong>.</p>`,
          `<p>Pickup: <strong>${pickup}</strong><br/>Return: <strong>${ret}</strong></p>`,
          '<p>Next: upload the required documents so our team can review your request.</p>',
          `<p><a href="${docsUrl}">Upload documents</a></p>`,
        ]),
        templateName: WHATSAPP_TEMPLATE_NAMES.bookingRequested,
        templateParams: [name, invoice, pickup, ret],
      };
    case BOOKING_NOTIFICATION_EVENTS.documentsSubmitted:
      return {
        subject: `${company} — documents received (${invoice})`,
        text: [
          greeting(booking.customer_name),
          '',
          `Documents for ${invoice} are in. Our team will review your request shortly.`,
          '',
          `View request: ${bookingUrl}`,
        ].join('\n'),
        html: wrapHtml([
          `<p>${greeting(booking.customer_name)}</p>`,
          `<p>Documents for <strong>${invoice}</strong> are in. Our team will review your request shortly.</p>`,
          `<p><a href="${bookingUrl}">View request</a></p>`,
        ]),
        templateName: WHATSAPP_TEMPLATE_NAMES.documentsSubmitted,
        templateParams: [name, invoice],
      };
    case BOOKING_NOTIFICATION_EVENTS.bookingApproved:
      return {
        subject: `${company} — booking confirmed (${invoice})`,
        text: [
          greeting(booking.customer_name),
          '',
          `Your booking ${invoice} is confirmed. The vehicle is reserved for your dates.`,
          `Pickup: ${pickup} · Return: ${ret}`,
          `Total amount: ${total}`,
          'Please pay the total amount when collecting the vehicle. Carry your original documents for verification.',
          '',
          `View booking: ${bookingUrl}`,
        ].join('\n'),
        html: wrapHtml([
          `<p>${greeting(booking.customer_name)}</p>`,
          `<p>Your booking <strong>${invoice}</strong> is confirmed. The vehicle is reserved for your dates.</p>`,
          `<p>Pickup: <strong>${pickup}</strong><br/>Return: <strong>${ret}</strong></p>`,
          `<p>Total amount: <strong>${total}</strong></p>`,
          '<p>Please pay the total amount when collecting the vehicle. Carry your original documents for verification.</p>',
          `<p><a href="${bookingUrl}">View booking</a></p>`,
        ]),
        templateName: WHATSAPP_TEMPLATE_NAMES.bookingApproved,
        templateParams: [name, invoice, pickup, ret, total],
      };
    case BOOKING_NOTIFICATION_EVENTS.bookingRejected:
      return {
        subject: `${company} — booking request update (${invoice})`,
        text: [
          greeting(booking.customer_name),
          '',
          `Your booking request ${invoice} could not be approved.`,
          `Reason: ${reason}`,
          '',
          `View details: ${bookingUrl}`,
        ].join('\n'),
        html: wrapHtml([
          `<p>${greeting(booking.customer_name)}</p>`,
          `<p>Your booking request <strong>${invoice}</strong> could not be approved.</p>`,
          `<p><strong>Reason:</strong> ${reason}</p>`,
          `<p><a href="${bookingUrl}">View details</a></p>`,
        ]),
        templateName: WHATSAPP_TEMPLATE_NAMES.bookingRejected,
        templateParams: [name, invoice, reason],
      };
    case BOOKING_NOTIFICATION_EVENTS.paymentCollected:
      return {
        subject: `${company} — payment recorded (${invoice})`,
        text: [
          greeting(booking.customer_name),
          '',
          `Payment of ${amount} has been recorded for booking ${invoice}.`,
          `Method: ${method}`,
          `Collected: ${collectedAt}`,
          'Your booking remains confirmed.',
          '',
          `View booking: ${bookingUrl}`,
        ].join('\n'),
        html: wrapHtml([
          `<p>${greeting(booking.customer_name)}</p>`,
          `<p>Payment of <strong>${amount}</strong> has been recorded for booking <strong>${invoice}</strong>.</p>`,
          `<p>Method: <strong>${method}</strong></p>`,
          '<p>Your booking remains confirmed.</p>',
          `<p><a href="${bookingUrl}">View booking</a></p>`,
        ]),
        templateName: WHATSAPP_TEMPLATE_NAMES.paymentCollected,
        templateParams: [name, invoice, amount, method],
      };
    case BOOKING_NOTIFICATION_EVENTS.bookingCancelled:
      return {
        subject: `${company} — booking cancelled (${invoice})`,
        text: [
          greeting(booking.customer_name),
          '',
          `Booking ${invoice} has been cancelled.`,
          '',
          `View details: ${bookingUrl}`,
        ].join('\n'),
        html: wrapHtml([
          `<p>${greeting(booking.customer_name)}</p>`,
          `<p>Booking <strong>${invoice}</strong> has been cancelled.</p>`,
          `<p><a href="${bookingUrl}">View details</a></p>`,
        ]),
        templateName: WHATSAPP_TEMPLATE_NAMES.bookingCancelled,
        templateParams: [name, invoice, 'Cancelled'],
      };
    case BOOKING_NOTIFICATION_EVENTS.bookingUpdated:
      return {
        subject: `${company} — booking updated (${invoice})`,
        text: [
          greeting(booking.customer_name),
          '',
          `Your booking ${invoice} was updated.`,
          updateSummary,
          `Pickup: ${pickup} · Return: ${ret}`,
          '',
          `View booking: ${bookingUrl}`,
        ].join('\n'),
        html: wrapHtml([
          `<p>${greeting(booking.customer_name)}</p>`,
          `<p>Your booking <strong>${invoice}</strong> was updated.</p>`,
          `<p>${updateSummary}</p>`,
          `<p>Pickup: <strong>${pickup}</strong><br/>Return: <strong>${ret}</strong></p>`,
          `<p><a href="${bookingUrl}">View booking</a></p>`,
        ]),
        templateName: WHATSAPP_TEMPLATE_NAMES.bookingUpdated,
        templateParams: [name, invoice, pickup, ret],
      };
  }
}

function wrapHtml(lines: readonly string[]): string {
  return lines.join('');
}
