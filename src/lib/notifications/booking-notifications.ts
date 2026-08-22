import 'server-only';

import { notificationsConfig } from '@/config/notifications';
import {
  customerBookingConfirmationPath,
  customerBookingPaymentPath,
  customerBookingPath,
} from '@/constants/routes';
import { sendTransactionalEmail } from '@/lib/notifications/send-email';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import type { Booking } from '@/types';

function absoluteUrl(path: string): string {
  const origin = notificationsConfig.appOrigin;
  if (!origin) {
    return path;
  }
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function greeting(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `Hi ${trimmed},` : 'Hi,';
}

/**
 * Best-effort — never throws. Failures are logged for ops visibility.
 */
function dispatch(promise: Promise<unknown>, label: string): void {
  void promise.catch((error: unknown) => {
    console.error(`[booking-notification] ${label} failed`, error);
  });
}

export function notifyBookingApproved(input: {
  readonly booking: Booking;
  readonly customerEmail: string;
}): void {
  const { booking, customerEmail } = input;
  const payBy = booking.payment_due_at ? formatDateTime(booking.payment_due_at) : null;

  dispatch(
    sendTransactionalEmail({
      to: customerEmail,
      subject: `${notificationsConfig.companyName} — booking approved (${booking.invoice_number})`,
      text: [
        greeting(booking.customer_name),
        '',
        `Your booking request ${booking.invoice_number} has been approved.`,
        `Pickup: ${formatDate(booking.delivery_date)} · Return: ${formatDate(booking.return_date)}`,
        payBy
          ? `Please complete payment by ${payBy}.`
          : 'Please complete payment to confirm your booking.',
        '',
        `Pay now: ${absoluteUrl(customerBookingPaymentPath(booking.id))}`,
        '',
        `View booking: ${absoluteUrl(customerBookingPath(booking.id))}`,
      ].join('\n'),
      html: [
        `<p>${greeting(booking.customer_name)}</p>`,
        `<p>Your booking request <strong>${booking.invoice_number}</strong> has been approved.</p>`,
        `<p>Pickup: <strong>${formatDate(booking.delivery_date)}</strong><br/>Return: <strong>${formatDate(booking.return_date)}</strong></p>`,
        payBy
          ? `<p>Please complete payment by <strong>${payBy}</strong>.</p>`
          : '<p>Please complete payment to confirm your booking.</p>',
        `<p><a href="${absoluteUrl(customerBookingPaymentPath(booking.id))}">Pay now</a></p>`,
        `<p><a href="${absoluteUrl(customerBookingPath(booking.id))}">View booking</a></p>`,
      ].join(''),
    }),
    'approved',
  );
}

export function notifyBookingRejected(input: {
  readonly booking: Booking;
  readonly customerEmail: string;
  readonly reason: string;
}): void {
  const { booking, customerEmail, reason } = input;

  dispatch(
    sendTransactionalEmail({
      to: customerEmail,
      subject: `${notificationsConfig.companyName} — booking request update (${booking.invoice_number})`,
      text: [
        greeting(booking.customer_name),
        '',
        `Your booking request ${booking.invoice_number} could not be approved.`,
        `Reason: ${reason}`,
        '',
        `View details: ${absoluteUrl(customerBookingPath(booking.id))}`,
      ].join('\n'),
      html: [
        `<p>${greeting(booking.customer_name)}</p>`,
        `<p>Your booking request <strong>${booking.invoice_number}</strong> could not be approved.</p>`,
        `<p><strong>Reason:</strong> ${reason}</p>`,
        `<p><a href="${absoluteUrl(customerBookingPath(booking.id))}">View details</a></p>`,
      ].join(''),
    }),
    'rejected',
  );
}

export function notifyBookingPaymentConfirmed(input: {
  readonly booking: Booking;
  readonly customerEmail: string;
  readonly amountPaid: number;
}): void {
  const { booking, customerEmail, amountPaid } = input;
  const formattedAmount = formatCurrency(amountPaid, { maximumFractionDigits: 0 });

  dispatch(
    sendTransactionalEmail({
      to: customerEmail,
      subject: `${notificationsConfig.companyName} — booking confirmed (${booking.invoice_number})`,
      text: [
        greeting(booking.customer_name),
        '',
        `Payment of ${formattedAmount} received for booking ${booking.invoice_number}.`,
        `Pickup: ${formatDate(booking.delivery_date)} · Return: ${formatDate(booking.return_date)}`,
        '',
        `View confirmation: ${absoluteUrl(customerBookingConfirmationPath(booking.id))}`,
      ].join('\n'),
      html: [
        `<p>${greeting(booking.customer_name)}</p>`,
        `<p>Payment of <strong>${formattedAmount}</strong> received for booking <strong>${booking.invoice_number}</strong>.</p>`,
        `<p>Pickup: <strong>${formatDate(booking.delivery_date)}</strong><br/>Return: <strong>${formatDate(booking.return_date)}</strong></p>`,
        `<p>Your car is reserved for the selected dates.</p>`,
        `<p><a href="${absoluteUrl(customerBookingConfirmationPath(booking.id))}">View confirmation</a></p>`,
      ].join(''),
    }),
    'payment-confirmed',
  );
}
