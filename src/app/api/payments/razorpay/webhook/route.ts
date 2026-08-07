/**
 * Razorpay webhook endpoint (C6 infrastructure).
 *
 * Verifies the provider signature, attaches gateway payment ids, and does NOT
 * mark payments paid or bookings confirmed. Authoritative confirmation is C7.
 */

import { NextResponse } from 'next/server';

import { verifyRazorpayWebhookSignature } from '@/features/payments/lib/razorpay-gateway';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RazorpayWebhookPayload = {
  readonly event?: string;
  readonly payload?: {
    readonly payment?: {
      readonly entity?: {
        readonly id?: string;
        readonly order_id?: string;
        readonly status?: string;
        readonly amount?: number;
      };
    };
    readonly order?: {
      readonly entity?: {
        readonly id?: string;
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

  const providerPaymentId = payload.payload?.payment?.entity?.id?.trim() || null;
  const providerOrderId =
    payload.payload?.payment?.entity?.order_id?.trim() ||
    payload.payload?.order?.entity?.id?.trim() ||
    null;

  // C6: store gateway payment reference only. Do not trust body status/amount.
  // C7 will verify and mark paid + confirm booking.
  if (providerOrderId && providerPaymentId) {
    try {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.rpc('attach_payment_provider_payment_id', {
        p_provider_order_id: providerOrderId,
        p_provider_payment_id: providerPaymentId,
      });

      if (error) {
        return NextResponse.json({ error: 'Unable to record webhook.' }, { status: 500 });
      }
    } catch {
      return NextResponse.json({ error: 'Unable to record webhook.' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
