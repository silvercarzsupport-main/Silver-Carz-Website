/**
 * Razorpay gateway adapter (server-only).
 * Creates orders and verifies webhook signatures.
 */

import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import Razorpay from 'razorpay';

import { razorpayConfig } from '@/config/razorpay';
import {
  createPaymentConfigurationError,
  createPaymentGatewayFailureError,
} from '@/features/payments/errors';

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
}): boolean {
  const secret = razorpayConfig.webhookSecret;
  if (!secret || !input.signature) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(input.rawBody).digest('hex');

  try {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(input.signature, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
