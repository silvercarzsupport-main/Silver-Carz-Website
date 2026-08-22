'use server';

/**
 * Customer booking payment Server Actions (C6).
 */

import { getPaymentService } from '@/features/payments/service/payment-service';
import type { ApiResponse, PaymentSummary, RazorpayCheckoutSession } from '@/types';
import type { PaymentPageData } from '@/features/payments/service/payment-service';

export async function getBookingPaymentPageData(
  bookingId: string,
): Promise<ApiResponse<PaymentPageData>> {
  return getPaymentService().getPaymentPageData(bookingId);
}

export async function createBookingPaymentCheckout(
  bookingId: string,
): Promise<ApiResponse<RazorpayCheckoutSession>> {
  return getPaymentService().createCheckoutSession(bookingId);
}

export async function confirmBookingPayment(input: {
  readonly bookingId: string;
  readonly razorpayOrderId: string;
  readonly razorpayPaymentId: string;
  readonly razorpaySignature: string;
}): Promise<ApiResponse<PaymentSummary>> {
  return getPaymentService().confirmCheckout(input);
}

export async function markBookingPaymentFailed(input: {
  readonly paymentId: string;
  readonly reason?: string | null;
}): Promise<ApiResponse<PaymentSummary>> {
  return getPaymentService().markAttemptFailed(input);
}

export async function markBookingPaymentCancelled(input: {
  readonly paymentId: string;
}): Promise<ApiResponse<PaymentSummary>> {
  return getPaymentService().markAttemptCancelled(input);
}

export async function listBookingPaymentsForStaff(
  bookingId: string,
): Promise<ApiResponse<PaymentSummary[]>> {
  return getPaymentService().listPaymentsForStaff(bookingId);
}
