import { describe, expect, it } from 'vitest';

import { requiredBookingDocumentTypes } from '@/constants/booking-documents';
import { getBookingDocumentCompleteness } from '@/features/booking-documents/lib/completeness';
import {
  getBookingHorizonEndIso,
  todayIsoIst,
} from '@/features/customer-booking/lib/calendar-dates';
import { getCustomerRequestStatusPresentation } from '@/features/customer-booking/lib/request-status';
import {
  customerBookingDatesSchema,
  customerBookingRequestSchema,
} from '@/features/customer-booking/validations/request';
import { getPaymentEligibility } from '@/features/payments/lib/eligibility';
import { pricingFromBooking } from '@/features/bookings/service/pricing.service';
import { BOOKING_PAYMENT_STATUSES, BOOKING_STATUSES } from '@/types/enums';
import type { Booking, Payment } from '@/types';

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    invoice_number: 'SC-2026-00001',
    vehicle_id: 'vehicle-1',
    mode: 'with_driver',
    customer_name: 'Asha Kumar',
    address: '12 MG Road',
    city: 'Nagpur',
    state: 'Maharashtra',
    zip_code: '440001',
    place_to_visit: null,
    document_submitted: false,
    contact_number: '+91 98765 43210',
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
    status: BOOKING_STATUSES.draft,
    notes: null,
    rejection_reason: null,
    payment_due_at: null,
    created_by: 'user-1',
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
}

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'pay-1',
    booking_id: 'booking-1',
    customer_id: 'user-1',
    provider: 'razorpay',
    status: BOOKING_PAYMENT_STATUSES.pending,
    amount: 9000,
    currency: 'INR',
    provider_order_id: 'order_1',
    provider_payment_id: null,
    receipt: null,
    failure_reason: null,
    metadata: {},
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('customer booking pipeline — request validation', () => {
  it('accepts a valid booking request payload', () => {
    const deliveryDate = todayIsoIst();
    const returnDate = getBookingHorizonEndIso(deliveryDate);

    const parsed = customerBookingRequestSchema.safeParse({
      vehicleId: '00000000-0000-4000-8000-000000000001',
      mode: 'without_driver',
      customerName: 'Asha Kumar',
      address: '12 MG Road',
      city: 'Nagpur',
      state: 'Maharashtra',
      zipCode: '440001',
      contactNumber: '+91 98765 43210',
      deliveryDate,
      returnDate,
      placeToVisit: '',
      whatsappUpdates: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects inverted hire dates', () => {
    const deliveryDate = getBookingHorizonEndIso(todayIsoIst());
    const returnDate = todayIsoIst();

    const parsed = customerBookingDatesSchema.safeParse({
      vehicleId: '00000000-0000-4000-8000-000000000001',
      deliveryDate,
      returnDate,
    });

    expect(parsed.success).toBe(false);
  });
});

describe('customer booking pipeline — documents gate', () => {
  it('requires all mandatory document types before submission', () => {
    const required = requiredBookingDocumentTypes();
    expect(required).toHaveLength(3);

    const incomplete = getBookingDocumentCompleteness(['driving_license']);
    expect(incomplete.isComplete).toBe(false);
    expect(incomplete.missingTypes).toContain('government_id');

    const complete = getBookingDocumentCompleteness([
      'driving_license',
      'government_id',
      'address_proof',
    ]);
    expect(complete.isComplete).toBe(true);
    expect(complete.missingTypes).toHaveLength(0);
  });
});

describe('customer booking pipeline — lifecycle states', () => {
  it('walks draft → documents → pending approval → approved → paid', () => {
    let current = booking({ status: BOOKING_STATUSES.draft, document_submitted: false });

    expect(getPaymentEligibility(current).state).toBe('documents_needed');
    expect(getCustomerRequestStatusPresentation(current).label).toBe('Documents needed');

    current = { ...current, document_submitted: true };
    expect(getPaymentEligibility(current).state).toBe('pending_approval');
    expect(getCustomerRequestStatusPresentation(current).label).toBe('Pending approval');

    current = {
      ...current,
      status: BOOKING_STATUSES.confirmed,
      payment_due_at: '2099-01-09T12:00:00.000Z',
    };
    const approvedEligibility = getPaymentEligibility(current);
    expect(approvedEligibility.state).toBe('payment_required');
    expect(approvedEligibility.canPay).toBe(true);
    expect(approvedEligibility.amountPayable).toBe(9000);
    expect(getCustomerRequestStatusPresentation(current).label).toBe('Approved');

    current = { ...current, booking_amount: 9000, payment_due_at: null };
    expect(getPaymentEligibility(current).state).toBe('already_paid');
    expect(getCustomerRequestStatusPresentation(current).label).toBe('Confirmed');
  });

  it('blocks payment after rejection or cancellation', () => {
    expect(getPaymentEligibility(booking({ status: BOOKING_STATUSES.denied })).state).toBe(
      'rejected',
    );
    expect(getPaymentEligibility(booking({ status: BOOKING_STATUSES.cancelled })).state).toBe(
      'cancelled',
    );
  });

  it('allows retry while a pending gateway attempt exists after window expiry', () => {
    const eligibility = getPaymentEligibility(
      booking({
        status: BOOKING_STATUSES.confirmed,
        payment_due_at: '2020-01-01T00:00:00.000Z',
      }),
      [payment({ status: BOOKING_PAYMENT_STATUSES.pending })],
    );

    expect(eligibility.state).toBe('payment_processing');
    expect(eligibility.canPay).toBe(true);
  });
});

describe('customer booking pipeline — pricing and payment amount', () => {
  it('derives the payable balance from persisted booking totals', () => {
    const unpaid = pricingFromBooking(booking({ total_amount: 9000, booking_amount: 0 }));
    expect(unpaid.remainingBalance).toBe(9000);

    const paid = pricingFromBooking(booking({ total_amount: 9000, booking_amount: 9000 }));
    expect(paid.remainingBalance).toBe(0);
  });

  it('treats a paid payment row as confirmation even if booking_amount lagged', () => {
    const eligibility = getPaymentEligibility(
      booking({ status: BOOKING_STATUSES.confirmed, booking_amount: 0 }),
      [payment({ status: BOOKING_PAYMENT_STATUSES.paid, amount: 9000 })],
    );

    expect(eligibility.state).toBe('already_paid');
  });
});
