import { describe, expect, it } from 'vitest';

import {
  assertCanCollectOfflinePayment,
  buildOfflinePaymentCollectionUpdate,
  getOfflinePaymentPresentation,
} from '@/features/bookings/lib/offline-payment';
import { isScheduleBlockingBooking } from '@/features/bookings/service/status.service';
import { getCustomerRequestStatusPresentation } from '@/features/customer-booking/lib/request-status';
import { hasPermission, PERMISSIONS } from '@/lib/auth/permissions';
import { APP_ROLES } from '@/lib/auth/roles';
import { BOOKING_NOTIFICATION_EVENTS } from '@/lib/notifications/events';
import { buildBookingNotificationCopy } from '@/lib/notifications/copy';
import type { Booking } from '@/types';
import { BOOKING_STATUSES, OFFLINE_PAYMENT_STATUSES, PAYMENT_METHODS } from '@/types/enums';

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    invoice_number: 'SC-2026-00001',
    vehicle_id: 'vehicle-1',
    mode: 'with_driver',
    customer_name: 'Asha Kumar',
    address: 'Nagpur',
    city: 'Nagpur',
    state: 'Maharashtra',
    zip_code: '440001',
    place_to_visit: null,
    document_submitted: true,
    contact_number: '9876543210',
    invoice_date: '2099-01-01',
    delivery_date: '2099-01-10',
    return_date: '2099-01-12',
    driver_name: null,
    daily_charge: 3000,
    fuel_range: null,
    duration: 3,
    booking_amount: 0,
    payment_method: null,
    total_amount: 9000,
    status: BOOKING_STATUSES.confirmed,
    notes: null,
    rejection_reason: null,
    payment_status: OFFLINE_PAYMENT_STATUSES.unpaid,
    payment_collected_at: null,
    payment_collected_by: null,
    payment_reference: null,
    created_by: 'user-1',
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('offline payment collection rules', () => {
  it('lets staff mark a confirmed unpaid booking as paid using the authoritative total', () => {
    const unpaid = booking({ status: BOOKING_STATUSES.confirmed, booking_amount: 0 });
    const patch = buildOfflinePaymentCollectionUpdate(unpaid, {
      paymentMethod: PAYMENT_METHODS.cash,
      paymentReference: 'UPI123',
      submittedAmount: 1,
      collectedBy: 'staff-1',
      collectedAt: new Date('2026-08-31T10:00:00.000Z'),
    });

    expect(patch.booking_amount).toBe(9000);
    expect(patch.payment_status).toBe('paid');
    expect(patch.payment_method).toBe('cash');
    expect(patch.payment_reference).toBe('UPI123');
    expect(patch.payment_collected_by).toBe('staff-1');
    expect(patch.payment_collected_at).toBe('2026-08-31T10:00:00.000Z');
  });

  it('lets staff mark an ongoing unpaid booking as paid', () => {
    expect(() =>
      assertCanCollectOfflinePayment(booking({ status: BOOKING_STATUSES.ongoing })),
    ).not.toThrow();
  });

  it('rejects draft, denied, and cancelled bookings', () => {
    expect(() =>
      assertCanCollectOfflinePayment(booking({ status: BOOKING_STATUSES.draft })),
    ).toThrow(/confirmed, ongoing, or completed/);
    expect(() =>
      assertCanCollectOfflinePayment(booking({ status: BOOKING_STATUSES.denied })),
    ).toThrow(/confirmed, ongoing, or completed/);
    expect(() =>
      assertCanCollectOfflinePayment(booking({ status: BOOKING_STATUSES.cancelled })),
    ).toThrow(/confirmed, ongoing, or completed/);
  });

  it('rejects duplicate collection', () => {
    expect(() =>
      assertCanCollectOfflinePayment(
        booking({ payment_status: OFFLINE_PAYMENT_STATUSES.paid, booking_amount: 9000 }),
      ),
    ).toThrow(/already been recorded/);
  });

  it('validates payment method', () => {
    expect(() =>
      buildOfflinePaymentCollectionUpdate(booking(), {
        paymentMethod: 'bitcoin',
        collectedBy: 'staff-1',
      }),
    ).toThrow(/valid payment method/);
  });
});

describe('markBookingPaid authorization', () => {
  it('does not grant customers or anonymous roles booking-write permission', () => {
    expect(hasPermission(APP_ROLES.customer, PERMISSIONS.bookingsWrite)).toBe(false);
    expect(hasPermission(APP_ROLES.owner, PERMISSIONS.bookingsWrite)).toBe(true);
    expect(hasPermission(APP_ROLES.manager, PERMISSIONS.bookingsWrite)).toBe(true);
  });
});

describe('customer payment presentation', () => {
  it('shows Due at Pickup after approval and no Pay now CTA', () => {
    const approved = booking({ status: BOOKING_STATUSES.confirmed });
    const presentation = getCustomerRequestStatusPresentation(approved);
    expect(presentation.heading).toBe('Booking Confirmed');
    expect(presentation.label).toBe('Confirmed');
    expect(presentation.paymentLabel).toBe('Due at Pickup');
    expect(presentation.ctaLabel).not.toBe('Pay now');
    expect(presentation.description).toContain('when collecting the vehicle');
    expect(presentation.description.toLowerCase()).not.toContain('pay now');
  });

  it('shows Payment Collected after staff records payment', () => {
    const paid = booking({
      payment_status: OFFLINE_PAYMENT_STATUSES.paid,
      booking_amount: 9000,
      payment_method: PAYMENT_METHODS.cash,
      payment_collected_at: '2026-08-31T10:00:00.000Z',
    });
    const presentation = getCustomerRequestStatusPresentation(paid);
    expect(presentation.paymentLabel).toBe('Payment Collected');
  });

  it('does not treat draft, denied, or cancelled as payable', () => {
    expect(getOfflinePaymentPresentation(booking({ status: BOOKING_STATUSES.draft })).applicable).toBe(
      false,
    );
    expect(
      getOfflinePaymentPresentation(booking({ status: BOOKING_STATUSES.denied })).applicable,
    ).toBe(false);
    expect(
      getOfflinePaymentPresentation(booking({ status: BOOKING_STATUSES.cancelled })).applicable,
    ).toBe(false);
  });
});

describe('approval and availability', () => {
  it('does not require payment_due_at for a confirmed unpaid booking', () => {
    const approved = booking({ status: BOOKING_STATUSES.confirmed });
    expect('payment_due_at' in approved).toBe(false);
    expect(approved.payment_status).toBe('unpaid');
    expect(isScheduleBlockingBooking(approved)).toBe(true);
  });

  it('keeps the vehicle blocked while unpaid', () => {
    expect(isScheduleBlockingBooking(booking({ status: BOOKING_STATUSES.confirmed }))).toBe(true);
    expect(isScheduleBlockingBooking(booking({ status: BOOKING_STATUSES.ongoing }))).toBe(true);
  });
});

describe('notifications', () => {
  it('tells the customer payment is due at pickup on approval', () => {
    const copy = buildBookingNotificationCopy({
      event: BOOKING_NOTIFICATION_EVENTS.bookingApproved,
      booking: booking(),
    });
    expect(copy.text.toLowerCase()).toContain('collecting the vehicle');
    expect(copy.text.toLowerCase()).not.toContain('pay now');
    expect(copy.templateParams).toHaveLength(5);
    expect(copy.templateName).toBe('sc_booking_approved');
  });

  it('enqueues payment-collected copy with amount and method', () => {
    const copy = buildBookingNotificationCopy({
      event: BOOKING_NOTIFICATION_EVENTS.paymentCollected,
      booking: booking({
        payment_status: OFFLINE_PAYMENT_STATUSES.paid,
        booking_amount: 9000,
        payment_method: PAYMENT_METHODS.upi,
        payment_collected_at: '2026-08-31T10:00:00.000Z',
      }),
      amountPaid: 9000,
    });
    expect(copy.templateName).toBe('sc_payment_collected');
    expect(copy.text).toContain('SC-2026-00001');
    expect(copy.text).toContain('UPI');
    expect(copy.subject.toLowerCase()).toContain('payment recorded');
  });
});
