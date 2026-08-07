/**
 * Booking payment domain models (C6).
 */

import type { Enums, Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type PaymentProvider = Enums<'payment_provider'>;
export type BookingPaymentStatus = Enums<'booking_payment_status'>;

/** Persisted payment attempt (`public.payments`). */
export type Payment = Tables<'payments'>;

export type PaymentCreateInput = TablesInsert<'payments'>;

export type PaymentUpdateInput = TablesUpdate<'payments'>;

/** Safe customer/admin summary (no secrets). */
export type PaymentSummary = {
  readonly id: string;
  readonly bookingId: string;
  readonly customerId: string;
  readonly provider: PaymentProvider;
  readonly status: BookingPaymentStatus;
  readonly amount: number;
  readonly currency: string;
  readonly providerOrderId: string | null;
  readonly providerPaymentId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function toPaymentSummary(row: Payment): PaymentSummary {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    provider: row.provider,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    providerOrderId: row.provider_order_id,
    providerPaymentId: row.provider_payment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Safe Checkout payload returned to the browser. */
export type RazorpayCheckoutSession = {
  readonly paymentId: string;
  readonly orderId: string;
  readonly amountPaise: number;
  readonly currency: string;
  readonly keyId: string;
  readonly bookingId: string;
  readonly invoiceNumber: string;
  readonly customerName: string;
  readonly customerContact: string | null;
  readonly description: string;
};
