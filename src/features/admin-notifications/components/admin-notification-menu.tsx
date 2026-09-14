'use client';

import { Ban, Bell, FileCheck2, FilePlus2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { bookingDetailPath } from '@/constants/routes';
import {
  markAdminNotificationAsRead,
  markAllAdminNotificationsAsRead,
} from '@/features/admin-notifications/actions';
import { formatNotificationTime } from '@/features/admin-notifications/lib/copy';
import { ADMIN_NOTIFICATION_EVENTS } from '@/features/admin-notifications/lib/events';
import type { AdminNotificationItem } from '@/features/admin-notifications/types';
import { cn } from '@/lib/utils';

const EVENT_ICONS = {
  [ADMIN_NOTIFICATION_EVENTS.bookingRequested]: FilePlus2,
  [ADMIN_NOTIFICATION_EVENTS.documentsSubmitted]: FileCheck2,
  [ADMIN_NOTIFICATION_EVENTS.bookingCancelled]: Ban,
} as const;

type AdminNotificationMenuProps = {
  readonly items: readonly AdminNotificationItem[];
  readonly unreadCount: number;
  readonly loadError: boolean;
  readonly onOpen: () => void;
  readonly onFeedChange: (
    updater: (current: {
      readonly items: readonly AdminNotificationItem[];
      readonly unreadCount: number;
    }) => {
      readonly items: readonly AdminNotificationItem[];
      readonly unreadCount: number;
    },
  ) => void;
};

export function AdminNotificationMenu({
  items,
  unreadCount,
  loadError,
  onOpen,
  onFeedChange,
}: AdminNotificationMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);
  const ariaLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, none unread';

  const openBooking = useCallback(
    (item: AdminNotificationItem) => {
      startTransition(async () => {
        if (!item.readAt) {
          onFeedChange((current) => ({
            items: current.items.map((row) =>
              row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row,
            ),
            unreadCount: Math.max(0, current.unreadCount - 1),
          }));
          await markAdminNotificationAsRead(item.id);
        }

        if (item.bookingId) {
          router.push(bookingDetailPath(item.bookingId));
        }
      });
    },
    [onFeedChange, router],
  );

  const markAllRead = useCallback(() => {
    if (unreadCount === 0) {
      return;
    }

    startTransition(async () => {
      const now = new Date().toISOString();
      onFeedChange((current) => ({
        items: current.items.map((row) => ({
          ...row,
          readAt: row.readAt ?? now,
        })),
        unreadCount: 0,
      }));
      await markAllAdminNotificationsAsRead();
    });
  }, [onFeedChange, unreadCount]);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          onOpen();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={ariaLabel}>
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] leading-none font-semibold text-destructive-foreground">
              {badgeLabel}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 min-w-80 p-0 sm:w-96 sm:min-w-96">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={isPending || unreadCount === 0}
            onClick={markAllRead}
          >
            Mark all read
          </Button>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-80 overflow-y-auto py-1">
          {loadError ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Unable to load notifications.
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No booking alerts yet.
            </p>
          ) : (
            items.map((item) => {
              const Icon = EVENT_ICONS[item.event];
              const time = formatNotificationTime(item.createdAt);
              return (
                <DropdownMenuItem
                  key={item.id}
                  className={cn(
                    'items-start gap-2.5 rounded-none px-3 py-2.5',
                    !item.readAt && 'bg-primary/5',
                  )}
                  onSelect={() => {
                    openBooking(item);
                  }}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted',
                      !item.readAt && 'bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm leading-snug',
                          item.readAt ? 'font-medium' : 'font-semibold',
                        )}
                      >
                        {item.title}
                      </span>
                      {!item.readAt ? (
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {item.body}
                    </span>
                    {time ? (
                      <span className="mt-1 block text-[11px] text-muted-foreground">{time}</span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
