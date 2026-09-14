import { describe, expect, it } from 'vitest';

import { buildAdminNotificationCopy } from '@/features/admin-notifications/lib/copy';
import {
  ADMIN_NOTIFICATION_EVENTS,
  isAdminNotificationEvent,
} from '@/features/admin-notifications/lib/events';

describe('isAdminNotificationEvent', () => {
  it('accepts staff-inbox events only', () => {
    expect(isAdminNotificationEvent('booking_requested')).toBe(true);
    expect(isAdminNotificationEvent('documents_submitted')).toBe(true);
    expect(isAdminNotificationEvent('booking_cancelled')).toBe(true);
    expect(isAdminNotificationEvent('booking_approved')).toBe(false);
    expect(isAdminNotificationEvent('payment_collected')).toBe(false);
  });
});

describe('buildAdminNotificationCopy', () => {
  it('names the customer and invoice on a new request', () => {
    const copy = buildAdminNotificationCopy(ADMIN_NOTIFICATION_EVENTS.bookingRequested, {
      invoiceNumber: 'SC-2026-00003',
      customerName: 'Asha Kumar',
    });
    expect(copy.title).toBe('New booking request');
    expect(copy.body).toContain('Asha Kumar');
    expect(copy.body).toContain('SC-2026-00003');
  });

  it('flags documents ready for review', () => {
    const copy = buildAdminNotificationCopy(ADMIN_NOTIFICATION_EVENTS.documentsSubmitted, {
      invoiceNumber: 'SC-2026-00003',
      customerName: 'Asha Kumar',
    });
    expect(copy.title.toLowerCase()).toContain('documents');
    expect(copy.body).toContain('SC-2026-00003');
  });

  it('uses a dash when customer name is blank', () => {
    const copy = buildAdminNotificationCopy(ADMIN_NOTIFICATION_EVENTS.bookingCancelled, {
      invoiceNumber: 'SC-2026-00001',
      customerName: '  ',
    });
    expect(copy.body).toContain('—');
    expect(copy.body).toContain('SC-2026-00001');
  });
});
