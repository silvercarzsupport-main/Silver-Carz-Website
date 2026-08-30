export const BOOKING_NOTIFICATION_EVENTS = {
  bookingRequested: 'booking_requested',
  documentsSubmitted: 'documents_submitted',
  bookingApproved: 'booking_approved',
  bookingRejected: 'booking_rejected',
  paymentCollected: 'payment_collected',
  bookingCancelled: 'booking_cancelled',
  bookingUpdated: 'booking_updated',
} as const;

export type BookingNotificationEvent =
  (typeof BOOKING_NOTIFICATION_EVENTS)[keyof typeof BOOKING_NOTIFICATION_EVENTS];

export const BOOKING_NOTIFICATION_EVENT_VALUES = Object.values(
  BOOKING_NOTIFICATION_EVENTS,
) as BookingNotificationEvent[];

export function isBookingNotificationEvent(value: unknown): value is BookingNotificationEvent {
  return (
    typeof value === 'string' &&
    (BOOKING_NOTIFICATION_EVENT_VALUES as readonly string[]).includes(value)
  );
}

export function bookingNotificationIdempotencyKey(input: {
  readonly bookingId: string;
  readonly event: BookingNotificationEvent;
  readonly suffix?: string;
}): string {
  const base = `booking:${input.bookingId}:${input.event}`;
  return input.suffix ? `${base}:${input.suffix}` : base;
}
