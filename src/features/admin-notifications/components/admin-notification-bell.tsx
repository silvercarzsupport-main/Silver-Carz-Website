'use client';

import { useCallback, useEffect, useState } from 'react';

import { listAdminNotifications } from '@/features/admin-notifications/actions';
import { AdminNotificationMenu } from '@/features/admin-notifications/components/admin-notification-menu';
import type { AdminNotificationItem } from '@/features/admin-notifications/types';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const POLL_MS = 30_000;
const LOCAL_READS_KEY = 'sc.admin-notification-reads';

type FeedState = {
  readonly items: readonly AdminNotificationItem[];
  readonly unreadCount: number;
};

const EMPTY_FEED: FeedState = { items: [], unreadCount: 0 };

function loadLocalReads(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_READS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

function saveLocalReads(ids: ReadonlySet<string>): void {
  window.localStorage.setItem(LOCAL_READS_KEY, JSON.stringify([...ids]));
}

function applyLocalReads(feed: FeedState, localReads: ReadonlySet<string>): FeedState {
  const items = feed.items.map((item) =>
    item.readAt || !localReads.has(item.id) ? item : { ...item, readAt: item.readAt ?? 'local' },
  );
  return {
    items,
    unreadCount: items.filter((item) => !item.readAt).length,
  };
}

/**
 * Admin header bell: staff inbox for new requests, document submit, and cancels.
 */
export function AdminNotificationBell() {
  const [feed, setFeed] = useState<FeedState>(EMPTY_FEED);
  const [loadError, setLoadError] = useState(false);
  const [localReads, setLocalReads] = useState<Set<string>>(loadLocalReads);

  const refresh = useCallback(async () => {
    const result = await listAdminNotifications();
    if (!result.success) {
      setLoadError(true);
      return;
    }
    const reads = loadLocalReads();
    setLocalReads(reads);
    setLoadError(false);
    setFeed(applyLocalReads(result.data, reads));
  }, []);

  const onFeedChange = useCallback((updater: (current: FeedState) => FeedState) => {
    setFeed((current) => {
      const next = updater(current);
      const nextReads = new Set(loadLocalReads());
      for (const item of next.items) {
        if (item.readAt) {
          nextReads.add(item.id);
        }
      }
      saveLocalReads(nextReads);
      setLocalReads(nextReads);
      return applyLocalReads(next, nextReads);
    });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const displayFeed = applyLocalReads(feed, localReads);

  return (
    <AdminNotificationMenu
      items={displayFeed.items}
      unreadCount={displayFeed.unreadCount}
      loadError={loadError}
      onOpen={() => {
        void refresh();
      }}
      onFeedChange={onFeedChange}
    />
  );
}
