/**
 * Customer-facing booking request status labels and presentation.
 * Uses the Booking Status Automation Engine for lifecycle resolution.
 */

import {
  BOOKING_DISPLAY_STATUSES,
  getBookingStatusPresentation,
  type BookingStatusInput,
} from '@/features/bookings/service/status.service';
import { BOOKING_STATUSES } from '@/types/enums';

export type CustomerRequestStatusTone = 'pending' | 'success' | 'muted' | 'danger';

export type CustomerRequestStatusPresentation = {
  readonly label: string;
  readonly description: string;
  readonly tone: CustomerRequestStatusTone;
  readonly ctaLabel: string;
  readonly paymentAvailable: boolean;
  readonly rejectionReason: string | null;
};

const TONE_CLASSNAMES: Record<CustomerRequestStatusTone, string> = {
  pending: 'bg-tone-gold text-tone-gold-foreground',
  success: 'bg-success/15 text-success',
  muted: 'bg-muted text-muted-foreground',
  danger: 'bg-destructive/10 text-destructive',
};

export function customerRequestStatusToneClass(tone: CustomerRequestStatusTone): string {
  return TONE_CLASSNAMES[tone];
}

/**
 * Resolve how a booking request should appear on My Bookings / request detail.
 */
export function getCustomerRequestStatusPresentation(
  booking: BookingStatusInput & {
    readonly document_submitted?: boolean | null;
    readonly booking_amount?: number | null;
    readonly rejection_reason?: string | null;
  },
): CustomerRequestStatusPresentation {
  if (booking.status === BOOKING_STATUSES.draft) {
    if (!booking.document_submitted) {
      return {
        label: 'Documents needed',
        description: 'Upload your documents so Silver Carz can review this request.',
        tone: 'pending',
        ctaLabel: 'Upload documents',
        paymentAvailable: false,
        rejectionReason: null,
      };
    }

    return {
      label: 'Pending approval',
      description:
        'Your request is with Silver Carz for review. This is not a confirmed booking yet.',
      tone: 'pending',
      ctaLabel: 'View request',
      paymentAvailable: false,
      rejectionReason: null,
    };
  }

  const presentation = getBookingStatusPresentation(booking);
  const rejectionReason = booking.rejection_reason?.trim() || null;
  const unpaid = Number(booking.booking_amount ?? 0) <= 0;

  switch (presentation.status) {
    case BOOKING_DISPLAY_STATUSES.denied:
      return {
        label: 'Request rejected',
        description: rejectionReason
          ? 'Silver Carz rejected this request. See the reason below.'
          : 'Silver Carz rejected this request. It is kept in your history and is not an active booking.',
        tone: 'danger',
        ctaLabel: 'View details',
        paymentAvailable: false,
        rejectionReason,
      };
    case BOOKING_DISPLAY_STATUSES.cancelled:
      return {
        label: 'Cancelled',
        description: 'This booking was cancelled and is no longer active.',
        tone: 'danger',
        ctaLabel: 'View details',
        paymentAvailable: false,
        rejectionReason: null,
      };
    case BOOKING_DISPLAY_STATUSES.upcoming:
      return {
        label: unpaid ? 'Approved' : 'Confirmed',
        description: unpaid
          ? 'Your request was approved. Payment is now available.'
          : 'Your booking is confirmed. The vehicle is reserved for your pickup dates.',
        tone: 'success',
        ctaLabel: unpaid ? 'Pay now' : 'View booking',
        paymentAvailable: unpaid,
        rejectionReason: null,
      };
    case BOOKING_DISPLAY_STATUSES.active:
      return {
        label: 'Active',
        description: 'Your rental is in progress.',
        tone: 'success',
        ctaLabel: unpaid ? 'Pay now' : 'View booking',
        paymentAvailable: unpaid,
        rejectionReason: null,
      };
    case BOOKING_DISPLAY_STATUSES.completed:
      return {
        label: 'Completed',
        description: 'This rental has finished. Kept here as booking history.',
        tone: 'muted',
        ctaLabel: 'View details',
        paymentAvailable: false,
        rejectionReason: null,
      };
    default:
      return {
        label: presentation.label,
        description: presentation.description,
        tone: 'muted',
        ctaLabel: 'View details',
        paymentAvailable: false,
        rejectionReason: null,
      };
  }
}
