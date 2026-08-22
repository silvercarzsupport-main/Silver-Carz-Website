/**
 * Razorpay webhook endpoint.
 *
 * Verifies the provider signature, then confirms captured payments via the
 * Razorpay Payments API (never trusts webhook body amount/status).
 */

import { NextResponse } from 'next/server';

import { verifyRazorpayWebhookSignature } from '@/features/payments/lib/razorpay-gateway';
import { getPaymentService } from '@/features/payments/service/payment-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RazorpayWebhookPayload = {
  readonly event?: string;
  readonly payload?: {
    readonly payment?: {
      readonly entity?: {
        readonly id?: string;
        readonly order_id?: string;
        readonly error_description?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  let verified = false;
  try {
    verified = verifyRazorpayWebhookSignature({ rawBody, signature });
  } catch {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const event = payload.event?.trim() ?? '';
  const providerPaymentId = payload.payload?.payment?.entity?.id?.trim() || null;
  const providerOrderId = payload.payload?.payment?.entity?.order_id?.trim() || null;

  if (!providerOrderId || !providerPaymentId) {
    return NextResponse.json({ received: true });
  }

  const payments = getPaymentService();

  if (event === 'payment.captured') {
    const result = await payments.completeCapturedGatewayPayment({
      razorpayOrderId: providerOrderId,
      razorpayPaymentId: providerPaymentId,
    });

    if (!result.success) {
      return NextResponse.json({ error: 'Unable to confirm payment.' }, { status: 500 });
    }

    return NextResponse.json({ received: true, status: 'paid' });
  }

  if (event === 'payment.failed') {
    const result = await payments.markGatewayAttemptFailed({
      razorpayOrderId: providerOrderId,
      razorpayPaymentId: providerPaymentId,
      reason:
        payload.payload?.payment?.entity?.error_description ?? 'Payment failed at the gateway.',
    });

    if (!result.success) {
      return NextResponse.json({ error: 'Unable to record failed payment.' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
