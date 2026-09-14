export const ADMIN_NOTIFICATION_EVENTS = {
  bookingRequested: 'booking_requested',
  documentsSubmitted: 'documents_submitted',
  bookingCancelled: 'booking_cancelled',
} as const;

export type AdminNotificationEvent =
  (typeof ADMIN_NOTIFICATION_EVENTS)[keyof typeof ADMIN_NOTIFICATION_EVENTS];

export const ADMIN_NOTIFICATION_EVENT_VALUES = Object.values(
  ADMIN_NOTIFICATION_EVENTS,
) as AdminNotificationEvent[];

export function isAdminNotificationEvent(value: unknown): value is AdminNotificationEvent {
  return (
    typeof value === 'string' &&
    (ADMIN_NOTIFICATION_EVENT_VALUES as readonly string[]).includes(value)
  );
}
