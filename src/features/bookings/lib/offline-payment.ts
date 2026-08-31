/**
 * Offline pay-at-pickup collection — independent of booking lifecycle status.
 */

import { createBookingValidationError } from '@/features/bookings/errors';
import {
  BOOKING_DISPLAY_STATUSES,
  resolveBookingDisplayStatus,
  type BookingStatusInput,
} from '@/features/bookings/service/status.service';
import { pricingFromBooking } from '@/features/bookings/service/pricing.service';
import type { Booking, BookingUpdateInput, PaymentMethod } from '@/types';
import {
  BOOKING_STATUSES,
  OFFLINE_PAYMENT_STATUSES,
  isPaymentMethod,
  type BookingStatus,
  type OfflinePaymentStatus,
} from '@/types/enums';

export const COLLECTIBLE_BOOKING_STATUSES = [
  BOOKING_STATUSES.confirmed,
  BOOKING_STATUSES.ongoing,
  BOOKING_STATUSES.completed,
] as const satisfies readonly BookingStatus[];

export type CollectibleBookingStatus = (typeof COLLECTIBLE_BOOKING_STATUSES)[number];

export function isCollectibleBookingStatus(
  status: unknown,
): status is CollectibleBookingStatus {
  return (
    typeof status === 'string' &&
    (COLLECTIBLE_BOOKING_STATUSES as readonly string[]).includes(status)
  );
}

export type OfflinePaymentBadgeLabel =
  | 'Due at Pickup'
  | 'Payment Due'
  | 'Payment Overdue'
  | 'Paid'
  | 'Payment Collected';

export type OfflinePaymentPresentation = {
  readonly applicable: boolean;
  readonly collected: boolean;
  readonly canCollect: boolean;
  readonly adminLabel: OfflinePaymentBadgeLabel | null;
  readonly customerLabel: OfflinePaymentBadgeLabel | null;
};

type PaymentViewBooking = BookingStatusInput & {
  readonly payment_status?: OfflinePaymentStatus | null;
};

function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isCollected(booking: PaymentViewBooking): boolean {
  return booking.payment_status === OFFLINE_PAYMENT_STATUSES.paid;
}

export function getOfflinePaymentPresentation(
  booking: PaymentViewBooking,
  now: Date = new Date(),
): OfflinePaymentPresentation {
  const display = resolveBookingDisplayStatus(booking);
  const collected = isCollected(booking);
  const applicable =
    display === BOOKING_DISPLAY_STATUSES.upcoming ||
    display === BOOKING_DISPLAY_STATUSES.active ||
    display === BOOKING_DISPLAY_STATUSES.completed;

  if (!applicable) {
    return {
      applicable: false,
      collected: false,
      canCollect: false,
      adminLabel: null,
      customerLabel: null,
    };
  }

  if (collected) {
    return {
      applicable: true,
      collected: true,
      canCollect: false,
      adminLabel: 'Paid',
      customerLabel: 'Payment Collected',
    };
  }

  const today = todayIsoDate(now);
  let unpaidLabel: OfflinePaymentBadgeLabel = 'Due at Pickup';

  if (display === BOOKING_DISPLAY_STATUSES.upcoming) {
    unpaidLabel = 'Due at Pickup';
  } else if (display === BOOKING_DISPLAY_STATUSES.active) {
    unpaidLabel = booking.delivery_date < today ? 'Payment Overdue' : 'Payment Due';
  } else {
    unpaidLabel = 'Payment Overdue';
  }

  return {
    applicable: true,
    collected: false,
    canCollect: isCollectibleBookingStatus(booking.status),
    adminLabel: unpaidLabel,
    customerLabel: unpaidLabel === 'Due at Pickup' ? 'Due at Pickup' : unpaidLabel,
  };
}

export function assertCanCollectOfflinePayment(booking: Booking): void {
  if (!isCollectibleBookingStatus(booking.status)) {
    throw createBookingValidationError(
      'Payment can only be recorded for confirmed, ongoing, or completed bookings.',
    );
  }

  if (booking.payment_status === OFFLINE_PAYMENT_STATUSES.paid) {
    throw createBookingValidationError('Payment has already been recorded for this booking.');
  }
}

export type OfflinePaymentCollectionInput = {
  readonly paymentMethod: unknown;
  readonly paymentReference?: string | null;
  readonly submittedAmount?: number | null;
  readonly collectedBy: string;
  readonly collectedAt?: Date;
};

export function buildOfflinePaymentCollectionUpdate(
  booking: Booking,
  input: OfflinePaymentCollectionInput,
): BookingUpdateInput {
  assertCanCollectOfflinePayment(booking);

  if (!isPaymentMethod(input.paymentMethod)) {
    throw createBookingValidationError('Select a valid payment method.');
  }

  const pricing = pricingFromBooking(booking);
  const reference = input.paymentReference?.trim() || null;

  void input.submittedAmount;

  return {
    payment_status: OFFLINE_PAYMENT_STATUSES.paid,
    booking_amount: pricing.grandTotal,
    payment_method: input.paymentMethod,
    payment_reference: reference,
    payment_collected_at: (input.collectedAt ?? new Date()).toISOString(),
    payment_collected_by: input.collectedBy,
  };
}

export function parsePaymentReference(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw createBookingValidationError('Payment reference must be text.');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 120) {
    throw createBookingValidationError('Payment reference must be 120 characters or fewer.');
  }

  return trimmed;
}
