import { createHmac, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { getWhatsAppAppSecret, notificationsConfig } from '@/config/notifications';
import { toE164Phone } from '@/lib/notifications/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WhatsAppChange = {
  readonly value?: {
    readonly messages?: ReadonlyArray<{
      readonly from?: string;
      readonly text?: { readonly body?: string };
      readonly button?: { readonly text?: string };
    }>;
    readonly statuses?: ReadonlyArray<{
      readonly id?: string;
      readonly status?: string;
      readonly errors?: ReadonlyArray<{ readonly title?: string }>;
    }>;
  };
};

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = getWhatsAppAppSecret();
  if (!secret) {
    return false;
  }
  if (!header?.startsWith('sha256=')) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = header.slice('sha256='.length);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function isOptOutText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === 'stop' ||
    normalized === 'stopall' ||
    normalized === 'unsubscribe' ||
    normalized === 'cancel' ||
    normalized === 'end'
  );
}

async function optOutPhone(waId: string): Promise<void> {
  const e164 = toE164Phone(waId);
  if (!e164) {
    return;
  }

  const admin = createSupabaseAdminClient();
  await admin
    .from('profiles')
    .update({
      whatsapp_opt_in: false,
      whatsapp_opt_out_at: new Date().toISOString(),
    })
    .eq('phone', e164);
}

/** Meta webhook verification handshake. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = notificationsConfig.whatsappVerifyToken;

  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let payload: { readonly entry?: ReadonlyArray<{ readonly changes?: readonly WhatsAppChange[] }> };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          const body = message.text?.body ?? message.button?.text ?? '';
          if (message.from && isOptOutText(body)) {
            await optOutPhone(message.from);
          }
        }

        for (const status of change.value?.statuses ?? []) {
          if (status.status === 'failed') {
            console.error('[whatsapp] delivery failed', {
              id: status.id,
              errors: status.errors,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[whatsapp] webhook handling failed', error);
    return NextResponse.json({ error: 'Unable to process webhook.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
