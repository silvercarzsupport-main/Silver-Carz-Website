import 'server-only';

import { sendTransactionalEmail } from '@/lib/notifications/send-email';
import { sendWhatsAppTemplate } from '@/lib/notifications/send-whatsapp';
import { buildBookingNotificationCopy } from '@/lib/notifications/copy';
import type { BookingNotificationEvent } from '@/lib/notifications/events';
import { isBookingNotificationEvent } from '@/lib/notifications/events';
import { resolveBookingRecipient } from '@/lib/notifications/recipients';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Booking, Json } from '@/types';

const MAX_ATTEMPTS = 5;
const DRAIN_LIMIT = 20;

export type OutboxEnqueueInput = {
  readonly idempotencyKey: string;
  readonly event: BookingNotificationEvent;
  readonly booking: Booking;
  readonly reason?: string;
  readonly amountPaid?: number;
  readonly updateSummary?: string;
};

type OutboxRow = {
  readonly id: string;
  readonly event_type: string;
  readonly booking_id: string | null;
  readonly payload: Json;
  readonly attempts: number;
};

function asRecord(value: Json): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function payloadNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function loadBooking(bookingId: string): Promise<Booking | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data;
}

async function sendChannels(input: OutboxEnqueueInput): Promise<{
  readonly emailStatus: string;
  readonly whatsappStatus: string;
  readonly whatsappMessageId: string | null;
  readonly lastError: string | null;
}> {
  const recipient = await resolveBookingRecipient(input.booking);
  if (!recipient.isCustomer) {
    return {
      emailStatus: 'skipped',
      whatsappStatus: 'skipped',
      whatsappMessageId: null,
      lastError: null,
    };
  }

  const copy = buildBookingNotificationCopy({
    event: input.event,
    booking: input.booking,
    reason: input.reason,
    amountPaid: input.amountPaid,
    updateSummary: input.updateSummary,
  });

  let emailStatus = 'skipped';
  let whatsappStatus = 'skipped';
  let whatsappMessageId: string | null = null;
  const errors: string[] = [];

  if (recipient.email && recipient.emailConfirmed) {
    const emailResult = await sendTransactionalEmail({
      to: recipient.email,
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
    });
    if (emailResult.sent) {
      emailStatus = 'sent';
    } else if (emailResult.reason === 'disabled') {
      emailStatus = 'disabled';
    } else {
      emailStatus = 'failed';
      if (emailResult.error) {
        errors.push(`email: ${emailResult.error}`);
      }
    }
  }

  if (recipient.whatsappTo && recipient.emailConfirmed) {
    const whatsappResult = await sendWhatsAppTemplate({
      to: recipient.whatsappTo,
      templateName: copy.templateName,
      bodyParams: copy.templateParams,
      text: copy.text,
    });
    if (whatsappResult.sent) {
      whatsappStatus = whatsappResult.dryRun ? 'dry_run' : 'sent';
      whatsappMessageId = whatsappResult.id;
    } else if (whatsappResult.reason === 'disabled') {
      whatsappStatus = 'disabled';
    } else {
      whatsappStatus = 'failed';
      if (whatsappResult.error) {
        errors.push(`whatsapp: ${whatsappResult.error}`);
      }
    }
  }

  const delivered =
    emailStatus === 'sent' || whatsappStatus === 'sent' || whatsappStatus === 'dry_run';
  const attempted =
    emailStatus === 'failed' ||
    whatsappStatus === 'failed' ||
    emailStatus === 'sent' ||
    whatsappStatus === 'sent' ||
    whatsappStatus === 'dry_run';

  if (!attempted) {
    return {
      emailStatus,
      whatsappStatus,
      whatsappMessageId,
      lastError: null,
    };
  }

  return {
    emailStatus,
    whatsappStatus,
    whatsappMessageId,
    lastError: delivered ? null : errors.join('; ') || 'Notification channels failed.',
  };
}

async function markRow(
  id: string,
  patch: {
    readonly status: 'sent' | 'skipped' | 'failed' | 'processing';
    readonly attempts: number;
    readonly lastError: string | null;
    readonly emailStatus: string | null;
    readonly whatsappStatus: string | null;
    readonly whatsappMessageId: string | null;
  },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('notification_outbox')
    .update({
      status: patch.status,
      attempts: patch.attempts,
      last_error: patch.lastError,
      email_status: patch.emailStatus,
      whatsapp_status: patch.whatsappStatus,
      whatsapp_message_id: patch.whatsappMessageId,
      processed_at: patch.status === 'processing' ? null : new Date().toISOString(),
    })
    .eq('id', id);
}

async function processRow(row: OutboxRow): Promise<void> {
  if (!isBookingNotificationEvent(row.event_type) || !row.booking_id) {
    await markRow(row.id, {
      status: 'skipped',
      attempts: row.attempts + 1,
      lastError: 'Unknown event or missing booking.',
      emailStatus: 'skipped',
      whatsappStatus: 'skipped',
      whatsappMessageId: null,
    });
    return;
  }

  const booking = await loadBooking(row.booking_id);
  if (!booking) {
    await markRow(row.id, {
      status: row.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'failed',
      attempts: row.attempts + 1,
      lastError: 'Booking not found.',
      emailStatus: null,
      whatsappStatus: null,
      whatsappMessageId: null,
    });
    return;
  }

  const payload = asRecord(row.payload);
  const result = await sendChannels({
    idempotencyKey: row.id,
    event: row.event_type,
    booking,
    reason: payloadString(payload, 'rejection_reason') ?? payloadString(payload, 'reason'),
    amountPaid: payloadNumber(payload, 'amount_paid'),
    updateSummary: payloadString(payload, 'update_summary'),
  });

  const anySent =
    result.emailStatus === 'sent' ||
    result.whatsappStatus === 'sent' ||
    result.whatsappStatus === 'dry_run';
  const anyFailed = result.emailStatus === 'failed' || result.whatsappStatus === 'failed';

  await markRow(row.id, {
    status: anyFailed && !anySent ? 'failed' : anySent ? 'sent' : 'skipped',
    attempts: row.attempts + 1,
    lastError: result.lastError,
    emailStatus: result.emailStatus,
    whatsappStatus: result.whatsappStatus,
    whatsappMessageId: result.whatsappMessageId,
  });
}

export async function enqueueBookingNotification(input: OutboxEnqueueInput): Promise<void> {
  if (!input.booking.created_by) {
    await sendChannels(input);
    return;
  }

  try {
    const admin = createSupabaseAdminClient();
    await admin.rpc('insert_booking_notification_outbox', {
      p_idempotency_key: input.idempotencyKey,
      p_event_type: input.event,
      p_booking_id: input.booking.id,
      p_profile_id: input.booking.created_by,
      p_payload: {
        invoice_number: input.booking.invoice_number,
        customer_name: input.booking.customer_name,
        rejection_reason: input.reason ?? input.booking.rejection_reason,
        amount_paid: input.amountPaid ?? null,
        update_summary: input.updateSummary ?? null,
      },
    });
  } catch (error) {
    console.error('[booking-notification] outbox enqueue failed; sending directly', error);
    await sendChannels(input);
  }
}

export async function processPendingNotifications(limit = DRAIN_LIMIT): Promise<number> {
  let processed = 0;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('notification_outbox')
      .select('id, event_type, booking_id, payload, attempts')
      .in('status', ['pending', 'failed'])
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) {
      return 0;
    }

    for (const row of data) {
      await admin.from('notification_outbox').update({ status: 'processing' }).eq('id', row.id);
      try {
        await processRow(row);
      } catch (error) {
        await markRow(row.id, {
          status: 'failed',
          attempts: row.attempts + 1,
          lastError: error instanceof Error ? error.message : 'Processor crashed.',
          emailStatus: null,
          whatsappStatus: null,
          whatsappMessageId: null,
        });
      }
      processed += 1;
    }
  } catch (error) {
    console.error('[booking-notification] outbox drain failed', error);
  }

  return processed;
}
