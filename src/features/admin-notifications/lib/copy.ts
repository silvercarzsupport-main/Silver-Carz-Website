import { formatDistanceToNow } from 'date-fns';

import {
  ADMIN_NOTIFICATION_EVENTS,
  type AdminNotificationEvent,
} from '@/features/admin-notifications/lib/events';

export type AdminNotificationPayload = {
  readonly invoiceNumber: string;
  readonly customerName: string;
};

export type AdminNotificationCopy = {
  readonly title: string;
  readonly body: string;
};

function dash(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : '—';
}

/**
 * Staff-inbox copy for a booking event. WhatsApp/email templates are separate.
 */
export function buildAdminNotificationCopy(
  event: AdminNotificationEvent,
  payload: AdminNotificationPayload,
): AdminNotificationCopy {
  const invoice = dash(payload.invoiceNumber);
  const name = dash(payload.customerName);

  switch (event) {
    case ADMIN_NOTIFICATION_EVENTS.bookingRequested:
      return {
        title: 'New booking request',
        body: `${name} submitted ${invoice}. Review the request.`,
      };
    case ADMIN_NOTIFICATION_EVENTS.documentsSubmitted:
      return {
        title: 'Documents ready to review',
        body: `${name} uploaded documents for ${invoice}.`,
      };
    case ADMIN_NOTIFICATION_EVENTS.bookingCancelled:
      return {
        title: 'Booking cancelled',
        body: `${invoice} for ${name} was cancelled.`,
      };
  }
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return formatDistanceToNow(date, { addSuffix: true });
}
