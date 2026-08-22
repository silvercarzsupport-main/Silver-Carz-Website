/**
 * Razorpay gateway adapter (server-only).
 * Creates orders and verifies webhook signatures.
 */

import 'server-only';

import Razorpay from 'razorpay';

import { razorpayConfig } from '@/config/razorpay';
import { roundMoney } from '@/features/bookings/service/pricing.service';
import {
  createPaymentConfigurationError,
  createPaymentGatewayFailureError,
} from '@/features/payments/errors';
import { verifyHmacSha256Hex } from '@/features/payments/lib/hmac';
import { PAYMENT_METHODS, type PaymentMethod } from '@/types/enums';

export type RazorpayOrderResult = {
  readonly id: string;
  readonly amountPaise: number;
  readonly currency: string;
  readonly receipt: string | null;
};

function getRazorpayClient(): Razorpay {
  try {
    return new Razorpay({
      key_id: razorpayConfig.keyId,
      key_secret: razorpayConfig.keySecret,
    });
  } catch {
    throw createPaymentConfigurationError();
  }
}

/** Convert INR major units to paise for Razorpay. */
export function toRazorpayAmountPaise(amountInr: number): number {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw createPaymentGatewayFailureError();
  }
  return Math.round(amountInr * 100);
}

/**
 * Create a Razorpay order for the authoritative booking amount.
 * Receipt max length is 40 characters per Razorpay docs.
 */
export async function createRazorpayOrder(input: {
  readonly amountInr: number;
  readonly currency: string;
  readonly receipt: string;
  readonly notes: Record<string, string>;
}): Promise<RazorpayOrderResult> {
  const amountPaise = toRazorpayAmountPaise(input.amountInr);
  const receipt = input.receipt.slice(0, 40);
  const client = getRazorpayClient();

  try {
    const order = await client.orders.create({
      amount: amountPaise,
      currency: input.currency.toUpperCase(),
      receipt,
      notes: input.notes,
    });

    const orderId = typeof order.id === 'string' ? order.id : null;
    if (!orderId) {
      throw createPaymentGatewayFailureError();
    }

    return {
      id: orderId,
      amountPaise: Number(order.amount),
      currency: String(order.currency ?? input.currency).toUpperCase(),
      receipt: typeof order.receipt === 'string' ? order.receipt : receipt,
    };
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('Missing required environment')) {
      throw createPaymentConfigurationError();
    }
    throw createPaymentGatewayFailureError(cause);
  }
}

/** Verify Razorpay webhook signature (HMAC SHA256). */
export function verifyRazorpayWebhookSignature(input: {
  readonly rawBody: string;
  readonly signature: string | null;
  readonly secret?: string | null;
}): boolean {
  const secret = input.secret === undefined ? razorpayConfig.webhookSecret : input.secret;
  if (!secret || !input.signature) {
    return false;
  }

  return verifyHmacSha256Hex(secret, input.rawBody, input.signature);
}

/** Checkout success signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyRazorpayCheckoutSignature(input: {
  readonly orderId: string;
  readonly paymentId: string;
  readonly signature: string;
  readonly secret?: string;
}): boolean {
  const secret = input.secret ?? razorpayConfig.keySecret;
  if (!secret || !input.orderId || !input.paymentId || !input.signature) {
    return false;
  }

  return verifyHmacSha256Hex(secret, `${input.orderId}|${input.paymentId}`, input.signature);
}

export type RazorpayCapturedPayment = {
  readonly id: string;
  readonly orderId: string;
  readonly amountPaise: number;
  readonly amountInr: number;
  readonly currency: string;
  readonly status: string;
  readonly method: string | null;
};

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayCapturedPayment> {
  const client = getRazorpayClient();

  try {
    const payment = await client.payments.fetch(paymentId);
    const id = typeof payment.id === 'string' ? payment.id : '';
    const orderId = typeof payment.order_id === 'string' ? payment.order_id : '';
    const amountPaise = Number(payment.amount);
    const currency = String(payment.currency ?? 'INR').toUpperCase();
    const status = String(payment.status ?? '');
    const method = typeof payment.method === 'string' ? payment.method : null;

    if (!id || !orderId || !Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw createPaymentGatewayFailureError();
    }

    return {
      id,
      orderId,
      amountPaise,
      amountInr: roundMoney(amountPaise / 100),
      currency,
      status,
      method,
    };
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('Missing required environment')) {
      throw createPaymentConfigurationError();
    }
    throw createPaymentGatewayFailureError(cause);
  }
}

export function isCapturedRazorpayPayment(status: string): boolean {
  return status.trim().toLowerCase() === 'captured';
}

export function mapRazorpayMethodToPaymentMethod(method: string | null | undefined): PaymentMethod {
  switch (method?.trim().toLowerCase()) {
    case 'card':
      return PAYMENT_METHODS.card;
    case 'upi':
      return PAYMENT_METHODS.upi;
    case 'netbanking':
      return PAYMENT_METHODS.bankTransfer;
    default:
      return PAYMENT_METHODS.other;
  }
}
