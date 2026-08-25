import { describe, expect, it } from 'vitest';

import { BOOKING_NOTIFICATION_EVENTS } from '@/lib/notifications/events';
import { buildBookingNotificationCopy } from '@/lib/notifications/copy';
import { toE164Phone, toWhatsAppRecipient } from '@/lib/notifications/phone';
import { BOOKING_STATUSES } from '@/types/enums';
import type { Booking } from '@/types';

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
    payment_due_at: '2099-01-09T12:00:00.000Z',
    created_by: 'user-1',
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('toE164Phone', () => {
  it('normalizes 10-digit Indian mobiles', () => {
    expect(toE164Phone('98765 43210')).toBe('+919876543210');
    expect(toWhatsAppRecipient('+91 9876543210')).toBe('919876543210');
  });

  it('rejects too-short values', () => {
    expect(toE164Phone('123')).toBeNull();
  });
});

describe('buildBookingNotificationCopy', () => {
  it('includes payment CTA on approval', () => {
    const copy = buildBookingNotificationCopy({
      event: BOOKING_NOTIFICATION_EVENTS.bookingApproved,
      booking: booking(),
    });
    expect(copy.subject).toContain('approved');
    expect(copy.text).toContain('SC-2026-00001');
    expect(copy.templateParams).toHaveLength(5);
  });

  it('uses expiry copy for unpaid auto-cancels', () => {
    const copy = buildBookingNotificationCopy({
      event: BOOKING_NOTIFICATION_EVENTS.bookingCancelled,
      booking: booking({
        status: BOOKING_STATUSES.cancelled,
        notes: 'Released automatically because payment was not received in time.',
      }),
    });
    expect(copy.text).toContain('payment was not received in time');
  });
});
