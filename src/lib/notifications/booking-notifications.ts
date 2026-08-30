import 'server-only';

import type { BookingNotificationEvent } from '@/lib/notifications/events';
import {
  BOOKING_NOTIFICATION_EVENTS,
  bookingNotificationIdempotencyKey,
} from '@/lib/notifications/events';
import {
  enqueueBookingNotification,
  processPendingNotifications,
} from '@/lib/notifications/outbox';
import type { Booking } from '@/types';

/**
 * Best-effort — never throws. Failures are logged for ops visibility.
 */
function dispatch(promise: Promise<unknown>, label: string): void {
  void promise.catch((error: unknown) => {
    console.error(`[booking-notification] ${label} failed`, error);
  });
}

async function emit(input: {
  readonly event: BookingNotificationEvent;
  readonly booking: Booking;
  readonly suffix?: string;
  readonly reason?: string;
  readonly amountPaid?: number;
  readonly updateSummary?: string;
}): Promise<void> {
  await enqueueBookingNotification({
    idempotencyKey: bookingNotificationIdempotencyKey({
      bookingId: input.booking.id,
      event: input.event,
      suffix: input.suffix,
    }),
    event: input.event,
    booking: input.booking,
    reason: input.reason,
    amountPaid: input.amountPaid,
    updateSummary: input.updateSummary,
  });
  await processPendingNotifications();
}

export function notifyBookingRequested(input: { readonly booking: Booking }): void {
  dispatch(
    emit({ event: BOOKING_NOTIFICATION_EVENTS.bookingRequested, booking: input.booking }),
    'requested',
  );
}

export function notifyBookingDocumentsSubmitted(input: { readonly booking: Booking }): void {
  dispatch(
    emit({ event: BOOKING_NOTIFICATION_EVENTS.documentsSubmitted, booking: input.booking }),
    'documents-submitted',
  );
}

export function notifyBookingApproved(input: {
  readonly booking: Booking;
  readonly customerEmail?: string;
}): void {
  dispatch(
    emit({ event: BOOKING_NOTIFICATION_EVENTS.bookingApproved, booking: input.booking }),
    'approved',
  );
}

export function notifyBookingRejected(input: {
  readonly booking: Booking;
  readonly customerEmail?: string;
  readonly reason: string;
}): void {
  dispatch(
    emit({
      event: BOOKING_NOTIFICATION_EVENTS.bookingRejected,
      booking: input.booking,
      reason: input.reason,
    }),
    'rejected',
  );
}

export function notifyBookingPaymentCollected(input: {
  readonly booking: Booking;
  readonly amountPaid: number;
}): void {
  dispatch(
    emit({
      event: BOOKING_NOTIFICATION_EVENTS.paymentCollected,
      booking: input.booking,
      amountPaid: input.amountPaid,
    }),
    'payment-collected',
  );
}

export function notifyBookingCancelled(input: { readonly booking: Booking }): void {
  dispatch(
    emit({ event: BOOKING_NOTIFICATION_EVENTS.bookingCancelled, booking: input.booking }),
    'cancelled',
  );
}

export function notifyBookingUpdated(input: {
  readonly booking: Booking;
  readonly previous: Booking;
  readonly updateSummary: string;
}): void {
  const suffix = `${input.previous.delivery_date}:${input.previous.return_date}:${input.previous.vehicle_id}`;
  dispatch(
    emit({
      event: BOOKING_NOTIFICATION_EVENTS.bookingUpdated,
      booking: input.booking,
      suffix,
      updateSummary: input.updateSummary,
    }),
    'updated',
  );
}
