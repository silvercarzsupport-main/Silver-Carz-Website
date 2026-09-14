'use server';

import {
  listAdminNotificationFeed,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '@/features/admin-notifications/service/admin-notification-service';
import type { AdminNotificationFeed } from '@/features/admin-notifications/types';
import type { ApiResponse } from '@/types';

export async function listAdminNotifications(): Promise<ApiResponse<AdminNotificationFeed>> {
  return listAdminNotificationFeed();
}

export async function markAdminNotificationAsRead(
  notificationId: string,
): Promise<ApiResponse<{ readonly read: true }>> {
  return markAdminNotificationRead(notificationId);
}

export async function markAllAdminNotificationsAsRead(): Promise<
  ApiResponse<{ readonly marked: number }>
> {
  return markAllAdminNotificationsRead();
}
