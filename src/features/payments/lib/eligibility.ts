/**
 * Payment eligibility helpers for approved customer bookings (C6).
 *
 * Project mapping:
 * - draft → waiting for approval
 * - denied → rejected
 * - confirmed/ongoing + unpaid → payment required
 * - booking_amount > 0 or paid payment → already collected (no new Pay Now)
 */

import { pricingFromBooking } from '@/features/bookings/service/pricing.service';
import type { Booking, BookingPaymentStatus, Payment } from '@/types';
import { BOOKING_PAYMENT_STATUSES, BOOKING_STATUSES } from '@/types/enums';

export type PaymentGateState =
  | 'pending_approval'
  | 'documents_needed'
  | 'rejected'
  | 'cancelled'
  | 'payment_required'
  | 'payment_processing'
  | 'already_paid'
  | 'not_payable';

export type PaymentEligibility = {
  readonly state: PaymentGateState;
  readonly canPay: boolean;
  readonly amountPayable: number;
  readonly currency: 'INR';
  readonly title: string;
  readonly description: string;
};

function hasSuccessfulPayment(payments: readonly Payment[]): boolean {
  return payments.some((payment) => payment.status === BOOKING_PAYMENT_STATUSES.paid);
}

function hasPendingPayment(payments: readonly Payment[]): boolean {
  return payments.some((payment) => payment.status === BOOKING_PAYMENT_STATUSES.pending);
}

/**
 * Resolve whether the customer may initiate payment for this booking.
 * Amount is always derived from the Pricing Engine remaining balance.
 */
export function getPaymentEligibility(
  booking: Pick<
    Booking,
    | 'status'
    | 'document_submitted'
    | 'booking_amount'
    | 'total_amount'
    | 'daily_charge'
    | 'delivery_date'
    | 'return_date'
  >,
  payments: readonly Payment[] = [],
): PaymentEligibility {
  const pricing = pricingFromBooking(booking);
  const amountPayable = pricing.remainingBalance;
  const collected = pricing.amountPaid > 0 || hasSuccessfulPayment(payments) || amountPayable <= 0;

  if (booking.status === BOOKING_STATUSES.draft) {
    if (!booking.document_submitted) {
      return {
        state: 'documents_needed',
        canPay: false,
        amountPayable: 0,
        currency: 'INR',
        title: 'Documents needed',
        description: 'Upload your documents so Silver Carz can review this request.',
      };
    }

    return {
      state: 'pending_approval',
      canPay: false,
      amountPayable: 0,
      currency: 'INR',
      title: 'Waiting for approval',
      description: 'Your booking is waiting for approval.',
    };
  }

  if (booking.status === BOOKING_STATUSES.denied) {
    return {
      state: 'rejected',
      canPay: false,
      amountPayable: 0,
      currency: 'INR',
      title: 'Request rejected',
      description: 'Your booking request was rejected.',
    };
  }

  if (booking.status === BOOKING_STATUSES.cancelled) {
    return {
      state: 'cancelled',
      canPay: false,
      amountPayable: 0,
      currency: 'INR',
      title: 'Booking cancelled',
      description: 'This booking was cancelled and cannot be paid.',
    };
  }

  if (
    booking.status !== BOOKING_STATUSES.confirmed &&
    booking.status !== BOOKING_STATUSES.ongoing
  ) {
    return {
      state: 'not_payable',
      canPay: false,
      amountPayable: 0,
      currency: 'INR',
      title: 'Payment unavailable',
      description: 'Payment is not available for this booking.',
    };
  }

  if (collected) {
    return {
      state: 'already_paid',
      canPay: false,
      amountPayable: 0,
      currency: 'INR',
      title: 'Booking confirmed',
      description: 'Payment already completed.',
    };
  }

  if (hasPendingPayment(payments)) {
    return {
      state: 'payment_processing',
      canPay: true,
      amountPayable,
      currency: 'INR',
      title: 'Payment required',
      description:
        'Your booking has been approved. Payment is required. A previous attempt can be resumed or retried.',
    };
  }

  return {
    state: 'payment_required',
    canPay: true,
    amountPayable,
    currency: 'INR',
    title: 'Payment required',
    description: 'Your booking has been approved. Payment is required.',
  };
}

export function isTerminalPaymentStatus(status: BookingPaymentStatus): boolean {
  return (
    status === BOOKING_PAYMENT_STATUSES.paid ||
    status === BOOKING_PAYMENT_STATUSES.failed ||
    status === BOOKING_PAYMENT_STATUSES.cancelled
  );
}
