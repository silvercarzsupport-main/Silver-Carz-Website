import 'server-only';

import { APP_ROLES } from '@/lib/auth/roles';
import { toE164Phone, toWhatsAppRecipient } from '@/lib/notifications/phone';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Booking } from '@/types';

export type NotificationRecipient = {
  readonly profileId: string | null;
  readonly email: string | null;
  readonly emailConfirmed: boolean;
  readonly whatsappTo: string | null;
  readonly whatsappOptIn: boolean;
  readonly isCustomer: boolean;
};

function emptyRecipient(): NotificationRecipient {
  return {
    profileId: null,
    email: null,
    emailConfirmed: false,
    whatsappTo: null,
    whatsappOptIn: false,
    isCustomer: false,
  };
}

async function isEmailConfirmed(userId: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return true;
    }
    return Boolean(data.user.email_confirmed_at);
  } catch {
    return true;
  }
}

/**
 * Resolves who should receive booking notifications.
 * Staff-created bookings are skipped. WhatsApp requires opt-in + a valid mobile.
 */
export async function resolveBookingRecipient(booking: Booking): Promise<NotificationRecipient> {
  const profileId = booking.created_by;
  if (!profileId) {
    return emptyRecipient();
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('id, email, role, is_active, phone, whatsapp_opt_in')
      .eq('id', profileId)
      .maybeSingle();

    if (error || !data || !data.is_active || data.role !== APP_ROLES.customer) {
      return emptyRecipient();
    }

    const emailConfirmed = await isEmailConfirmed(profileId);
    const e164 = toE164Phone(data.phone) ?? toE164Phone(booking.contact_number);

    return {
      profileId: data.id,
      email: data.email?.trim() || null,
      emailConfirmed,
      whatsappTo: data.whatsapp_opt_in ? toWhatsAppRecipient(e164) : null,
      whatsappOptIn: data.whatsapp_opt_in,
      isCustomer: true,
    };
  } catch {
    return {
      profileId,
      email: null,
      emailConfirmed: true,
      whatsappTo: null,
      whatsappOptIn: false,
      isCustomer: false,
    };
  }
}
