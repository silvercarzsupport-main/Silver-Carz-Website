import 'server-only';

import { buildAdminNotificationCopy } from '@/features/admin-notifications/lib/copy';
import {
  ADMIN_NOTIFICATION_EVENT_VALUES,
  isAdminNotificationEvent,
  type AdminNotificationEvent,
} from '@/features/admin-notifications/lib/events';
import type {
  AdminNotificationFeed,
  AdminNotificationItem,
} from '@/features/admin-notifications/types';
import { PERMISSIONS, requirePermission } from '@/lib/auth';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fromPromise } from '@/services';
import type { ApiResponse, Json } from '@/types';

const FEED_LIMIT = 40;

type NotificationRow = {
  readonly id: string;
  readonly event_type: string;
  readonly booking_id: string | null;
  readonly payload: Json;
  readonly created_at: string;
};

function payloadField(payload: Json, key: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return '';
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function toItem(
  row: NotificationRow,
  event: AdminNotificationEvent,
  readAt: string | null,
): AdminNotificationItem {
  const copy = buildAdminNotificationCopy(event, {
    invoiceNumber: payloadField(row.payload, 'invoice_number'),
    customerName: payloadField(row.payload, 'customer_name'),
  });

  return {
    id: row.id,
    event,
    bookingId: row.booking_id,
    title: copy.title,
    body: copy.body,
    createdAt: row.created_at,
    readAt,
  };
}

function isDuplicateRead(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

function isMissingInbox(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

function mapRows(
  rows: readonly NotificationRow[],
  readAtById: ReadonlyMap<string, string>,
): AdminNotificationItem[] {
  return rows.flatMap((row) => {
    if (!isAdminNotificationEvent(row.event_type)) {
      return [];
    }
    return [toItem(row, row.event_type, readAtById.get(row.id) ?? null)];
  });
}

async function listFromOutboxFallback(): Promise<AdminNotificationFeed> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('notification_outbox')
    .select('id, event_type, booking_id, payload, created_at')
    .in('event_type', [...ADMIN_NOTIFICATION_EVENT_VALUES])
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT);

  if (error) {
    throw new AppError('Unable to load notifications.', ERROR_CODES.unknown);
  }

  const items = mapRows((data ?? []) as NotificationRow[], new Map());
  return { items, unreadCount: items.length };
}

export function listAdminNotificationFeed(): Promise<ApiResponse<AdminNotificationFeed>> {
  return fromPromise(async () => {
    const user = await requirePermission(PERMISSIONS.bookingsRead);
    const supabase = await createSupabaseServerClient();

    const [rowsResult, unreadResult] = await Promise.all([
      supabase
        .from('admin_notifications')
        .select('id, event_type, booking_id, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT),
      supabase.rpc('count_unread_admin_notifications'),
    ]);

    if (rowsResult.error) {
      if (isMissingInbox(rowsResult.error)) {
        return listFromOutboxFallback();
      }
      throw new AppError('Unable to load notifications.', ERROR_CODES.unknown);
    }

    const rows = (rowsResult.data ?? []) as NotificationRow[];
    const ids = rows.map((row) => row.id);
    const readAtById = new Map<string, string>();

    if (ids.length > 0) {
      const readsResult = await supabase
        .from('admin_notification_reads')
        .select('notification_id, read_at')
        .eq('profile_id', user.id)
        .in('notification_id', ids);

      if (readsResult.error && !isMissingInbox(readsResult.error)) {
        throw new AppError('Unable to load notifications.', ERROR_CODES.unknown);
      }

      for (const read of readsResult.data ?? []) {
        readAtById.set(read.notification_id, read.read_at);
      }
    }

    const items = mapRows(rows, readAtById);
    const unreadCount =
      !unreadResult.error &&
      typeof unreadResult.data === 'number' &&
      Number.isFinite(unreadResult.data)
        ? unreadResult.data
        : items.filter((item) => !item.readAt).length;

    return { items, unreadCount };
  });
}

export function markAdminNotificationRead(
  notificationId: string,
): Promise<ApiResponse<{ readonly read: true }>> {
  return fromPromise(async () => {
    const user = await requirePermission(PERMISSIONS.bookingsRead);
    const id = notificationId.trim();
    if (!id) {
      throw new AppError('Notification is required.', ERROR_CODES.validation);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('admin_notification_reads').insert({
      notification_id: id,
      profile_id: user.id,
    });

    if (error && !isDuplicateRead(error) && !isMissingInbox(error)) {
      throw new AppError('Unable to mark notification as read.', ERROR_CODES.unknown);
    }

    return { read: true as const };
  });
}

export function markAllAdminNotificationsRead(): Promise<ApiResponse<{ readonly marked: number }>> {
  return fromPromise(async () => {
    await requirePermission(PERMISSIONS.bookingsRead);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('mark_all_admin_notifications_read');

    if (error && !isMissingInbox(error)) {
      throw new AppError('Unable to mark notifications as read.', ERROR_CODES.unknown);
    }

    return { marked: typeof data === 'number' ? data : 0 };
  });
}
