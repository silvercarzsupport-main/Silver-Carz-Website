'use server';

/**
 * Marks a browser-established recovery session (implicit-flow hash tokens).
 * The caller must already have a verified Auth cookie session.
 */

import { AUTH_ERROR_CODES } from '@/lib/auth/errors';
import { setPasswordRecoveryCookie } from '@/lib/auth/password-reset-cookie';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { failWith, ok } from '@/services';
import type { ApiResponse } from '@/types';

export type EstablishPasswordRecoveryActionResult = ApiResponse<{ readonly ready: true }>;

export async function establishPasswordRecoveryAction(): Promise<EstablishPasswordRecoveryActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return failWith(
      AUTH_ERROR_CODES.recoveryInvalid,
      'This reset link is invalid or has expired. Request a new password reset email.',
    );
  }

  await setPasswordRecoveryCookie();
  return ok({ ready: true });
}
