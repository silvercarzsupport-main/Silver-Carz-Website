import type { AdminNotificationEvent } from '@/features/admin-notifications/lib/events';

export type AdminNotificationItem = {
  readonly id: string;
  readonly event: AdminNotificationEvent;
  readonly bookingId: string | null;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly readAt: string | null;
};

export type AdminNotificationFeed = {
  readonly items: readonly AdminNotificationItem[];
  readonly unreadCount: number;
};
