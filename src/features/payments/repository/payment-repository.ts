/**
 * Payment repository — Supabase data access for `public.payments`.
 */

import 'server-only';

import type { TypedSupabaseClient } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BookingPaymentStatus, Payment } from '@/types';

export type PaymentRepository = {
  listForBooking(bookingId: string): Promise<Payment[]>;
  findPendingForBooking(bookingId: string): Promise<Payment | null>;
  createAttempt(input: {
    readonly bookingId: string;
    readonly amount: number;
    readonly currency: string;
    readonly providerOrderId: string;
    readonly receipt?: string | null;
    readonly metadata?: Record<string, string>;
  }): Promise<Payment>;
  updateOwnOutcome(input: {
    readonly paymentId: string;
    readonly status: Extract<BookingPaymentStatus, 'failed' | 'cancelled'>;
    readonly providerPaymentId?: string | null;
    readonly failureReason?: string | null;
  }): Promise<Payment>;
};

export function createPaymentRepository(client: TypedSupabaseClient): PaymentRepository {
  return {
    async listForBooking(bookingId) {
      const { data, error } = await client
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as Payment[];
    },

    async findPendingForBooking(bookingId) {
      const { data, error } = await client
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('status', 'pending')
        .not('provider_order_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as Payment | null) ?? null;
    },

    async createAttempt(input) {
      const { data, error } = await client.rpc('create_booking_payment_attempt', {
        p_booking_id: input.bookingId,
        p_amount: input.amount,
        p_currency: input.currency,
        p_provider_order_id: input.providerOrderId,
        p_receipt: input.receipt ?? null,
        p_metadata: input.metadata ?? {},
      });

      if (error) {
        throw error;
      }

      return data as Payment;
    },

    async updateOwnOutcome(input) {
      const { data, error } = await client.rpc('update_own_payment_attempt_outcome', {
        p_payment_id: input.paymentId,
        p_status: input.status,
        p_provider_payment_id: input.providerPaymentId ?? null,
        p_failure_reason: input.failureReason ?? null,
      });

      if (error) {
        throw error;
      }

      return data as Payment;
    },
  };
}

export async function getPaymentRepository(): Promise<PaymentRepository> {
  const client = await createSupabaseServerClient();
  return createPaymentRepository(client);
}
