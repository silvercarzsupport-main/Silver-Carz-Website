import { describe, expect, it } from 'vitest';

import { datesOverlap } from '@/features/bookings/lib/date-overlap';
import {
  sniffBookingDocumentMime,
  claimedMimeMatchesSniff,
} from '@/features/booking-documents/lib/file-sniff';
import {
  expandInclusiveDateRange,
  getBookingHorizonEndIso,
  isPastDate,
  isWithinBookingHorizon,
} from '@/features/customer-booking/lib/calendar-dates';
import { getCustomerRequestStatusPresentation } from '@/features/customer-booking/lib/request-status';
import { citiesMatch } from '@/config/fleet-cities';
import { BOOKING_STATUSES, OFFLINE_PAYMENT_STATUSES } from '@/types/enums';
import type { Booking } from '@/types';

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    invoice_number: 'SC-2026-00001',
    vehicle_id: 'vehicle-1',
    mode: 'with_driver',
    customer_name: 'Asha',
    address: 'Nagpur',
    city: 'Nagpur',
    state: 'Maharashtra',
    zip_code: '440001',
    place_to_visit: null,
    document_submitted: true,
    contact_number: '9999999999',
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

describe('datesOverlap', () => {
  it('detects inclusive overlapping hire windows', () => {
    expect(datesOverlap('2026-08-10', '2026-08-12', '2026-08-12', '2026-08-14')).toBe(true);
    expect(datesOverlap('2026-08-10', '2026-08-12', '2026-08-13', '2026-08-14')).toBe(false);
    expect(datesOverlap('2026-08-10', '2026-08-10', '2026-08-10', '2026-08-10')).toBe(true);
  });
});

describe('document sniffing', () => {
  it('recognises PDF JPEG and PNG magic bytes', () => {
    expect(sniffBookingDocumentMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      'application/pdf',
    );
    expect(sniffBookingDocumentMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      sniffBookingDocumentMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(sniffBookingDocumentMime(new Uint8Array([0x00, 0x00]))).toBeNull();
    expect(claimedMimeMatchesSniff('image/jpg', 'image/jpeg')).toBe(true);
    expect(claimedMimeMatchesSniff('application/pdf', 'image/png')).toBe(false);
  });
});

describe('IST booking horizon', () => {
  it('keeps inclusive ranges and rejects past dates against a fixed today', () => {
    expect(expandInclusiveDateRange('2026-08-30', '2026-09-01')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
    expect(isPastDate('2026-08-16', '2026-08-17')).toBe(true);
    expect(isWithinBookingHorizon('2026-08-17', '2026-08-17')).toBe(true);
    expect(getBookingHorizonEndIso('2026-08-17')).toBe('2026-09-30');
    expect(isWithinBookingHorizon('2026-10-01', '2026-08-17')).toBe(false);
  });
});

describe('customer status + city matching', () => {
  it('shows confirmed with due-at-pickup while unpaid', () => {
    expect(getCustomerRequestStatusPresentation(booking({ booking_amount: 0 })).label).toBe(
      'Confirmed',
    );
    expect(getCustomerRequestStatusPresentation(booking({ booking_amount: 0 })).paymentLabel).toBe(
      'Due at Pickup',
    );
    expect(
      getCustomerRequestStatusPresentation(
        booking({
          booking_amount: 9000,
          payment_status: OFFLINE_PAYMENT_STATUSES.paid,
        }),
      ).paymentLabel,
    ).toBe('Payment Collected');
  });

  it('matches fleet cities without case noise', () => {
    expect(citiesMatch('nagpur', 'Nagpur')).toBe(true);
    expect(citiesMatch('Nagpur', 'Mumbai')).toBe(false);
  });
});
