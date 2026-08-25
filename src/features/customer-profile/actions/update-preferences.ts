'use server';

import { APP_ROLES, requireUser } from '@/lib/auth';
import { ERROR_CODES } from '@/lib/errors';
import { toE164Phone } from '@/lib/notifications/phone';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { failWith, ok } from '@/services';
import type { ApiResponse } from '@/types';

import {
  customerNotificationPreferencesSchema,
  type CustomerNotificationPreferencesInput,
} from '@/features/customer-profile/validations/preferences';

export async function updateCustomerNotificationPreferences(
  input: CustomerNotificationPreferencesInput,
): Promise<ApiResponse<{ readonly saved: true }>> {
  const parsed = customerNotificationPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return failWith(ERROR_CODES.validation, first?.message ?? 'Unable to save preferences.');
  }

  const user = await requireUser();
  if (user.role !== APP_ROLES.customer) {
    return failWith(ERROR_CODES.forbidden, 'Customer account required.');
  }

  const phone = parsed.data.phone.trim() ? toE164Phone(parsed.data.phone) : null;

  if (parsed.data.whatsappOptIn && !phone) {
    return failWith(ERROR_CODES.validation, 'Enter a valid WhatsApp mobile number.');
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      phone,
      whatsapp_opt_in: parsed.data.whatsappOptIn,
      whatsapp_opt_in_at: parsed.data.whatsappOptIn ? now : null,
      whatsapp_opt_out_at: parsed.data.whatsappOptIn ? null : now,
    })
    .eq('id', user.id);

  if (error) {
    return failWith(ERROR_CODES.unknown, 'Unable to save notification preferences.');
  }

  return ok({ saved: true });
}
