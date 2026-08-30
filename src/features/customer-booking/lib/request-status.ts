/**
 * Customer-facing booking request status labels and presentation.
 * Uses the Booking Status Automation Engine for lifecycle resolution.
 * Payment labels come from the offline collection helper — never from booking status.
 */

import { getOfflinePaymentPresentation } from '@/features/bookings/lib/offline-payment';
import {
  BOOKING_DISPLAY_STATUSES,
  getBookingStatusPresentation,
  type BookingStatusInput,
} from '@/features/bookings/service/status.service';
import { BOOKING_STATUSES, type OfflinePaymentStatus } from '@/types/enums';

export type CustomerRequestStatusTone = 'pending' | 'success' | 'muted' | 'danger';

export type CustomerRequestStatusPresentation = {
  readonly heading: string;
  readonly label: string;
  readonly description: string;
  readonly tone: CustomerRequestStatusTone;
  readonly ctaLabel: string;
  readonly paymentLabel: string | null;
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

const CONFIRMED_COPY =
  'Your booking is confirmed. Please pay the total amount when collecting the vehicle. Carry your original documents for verification.';

/**
 * Resolve how a booking request should appear on My Bookings / request detail.
 */
export function getCustomerRequestStatusPresentation(
  booking: BookingStatusInput & {
    readonly document_submitted?: boolean | null;
    readonly rejection_reason?: string | null;
    readonly payment_status?: OfflinePaymentStatus | null;
  },
): CustomerRequestStatusPresentation {
  if (booking.status === BOOKING_STATUSES.draft) {
    if (!booking.document_submitted) {
      return {
        heading: 'Documents needed',
        label: 'Documents needed',
        description: 'Upload your documents so Silver Carz can review this request.',
        tone: 'pending',
        ctaLabel: 'Upload documents',
        paymentLabel: null,
        rejectionReason: null,
      };
    }

    return {
      heading: 'Pending approval',
      label: 'Pending approval',
      description:
        'Your request is with Silver Carz for review. This is not a confirmed booking yet.',
      tone: 'pending',
      ctaLabel: 'View request',
      paymentLabel: null,
      rejectionReason: null,
    };
  }

  const presentation = getBookingStatusPresentation(booking);
  const payment = getOfflinePaymentPresentation(booking);
  const rejectionReason = booking.rejection_reason?.trim() || null;

  switch (presentation.status) {
    case BOOKING_DISPLAY_STATUSES.denied:
      return {
        heading: 'Request rejected',
        label: 'Request rejected',
        description: rejectionReason
          ? 'Silver Carz rejected this request. See the reason below.'
          : 'Silver Carz rejected this request. It is kept in your history and is not an active booking.',
        tone: 'danger',
        ctaLabel: 'View details',
        paymentLabel: null,
        rejectionReason,
      };
    case BOOKING_DISPLAY_STATUSES.cancelled:
      return {
        heading: 'Booking cancelled',
        label: 'Cancelled',
        description: 'This booking was cancelled and is no longer active.',
        tone: 'danger',
        ctaLabel: 'View details',
        paymentLabel: null,
        rejectionReason: null,
      };
    case BOOKING_DISPLAY_STATUSES.upcoming:
      return {
        heading: 'Booking Confirmed',
        label: 'Confirmed',
        description: payment.collected
          ? 'Your booking is confirmed. Payment has been collected.'
          : CONFIRMED_COPY,
        tone: 'success',
        ctaLabel: 'View booking',
        paymentLabel: payment.customerLabel,
        rejectionReason: null,
      };
    case BOOKING_DISPLAY_STATUSES.active:
      return {
        heading: 'Booking Confirmed',
        label: 'Ongoing',
        description: payment.collected
          ? 'Your rental is in progress. Payment has been collected.'
          : 'Your rental is in progress. Please complete payment with Silver Carz if it was not collected at pickup.',
        tone: 'success',
        ctaLabel: 'View booking',
        paymentLabel: payment.customerLabel,
        rejectionReason: null,
      };
    case BOOKING_DISPLAY_STATUSES.completed:
      return {
        heading: 'Booking details',
        label: 'Completed',
        description: payment.collected
          ? 'This rental has finished. Payment was collected.'
          : 'This rental has finished. Kept here as booking history.',
        tone: 'muted',
        ctaLabel: 'View details',
        paymentLabel: payment.customerLabel,
        rejectionReason: null,
      };
    default:
      return {
        heading: 'Booking details',
        label: presentation.label,
        description: presentation.description,
        tone: 'muted',
        ctaLabel: 'View details',
        paymentLabel: payment.customerLabel,
        rejectionReason: null,
      };
  }
}
