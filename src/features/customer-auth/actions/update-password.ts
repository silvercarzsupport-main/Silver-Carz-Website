'use server';

/**
 * Completes a customer password reset for a recovery session.
 *
 * Requires a verified Auth user plus the short-lived recovery cookie set by
 * `/auth/callback` (or the implicit-flow bootstrap). Other sessions are revoked.
 */

import { redirect } from 'next/navigation';

import {
  customerResetPasswordSchema,
  type CustomerResetPasswordInput,
} from '@/features/customer-auth/validations/credentials';
import { AUTH_ERROR_CODES, createSessionExpiredError, toAuthError } from '@/lib/auth/errors';
import {
  clearPasswordRecoveryCookie,
  hasPasswordRecoveryCookie,
} from '@/lib/auth/password-reset-cookie';
import { buildPasswordUpdatedLoginPath, isAuthNetworkError } from '@/lib/auth/password-reset';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail, failWith } from '@/services';
import type { ApiResponse } from '@/types';

export type UpdatePasswordActionResult = ApiResponse<null>;

export async function updatePasswordAction(
  input: CustomerResetPasswordInput,
  resumePath?: string | null,
): Promise<UpdatePasswordActionResult> {
  const parsed = customerResetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return failWith(ERROR_CODES.validation, firstIssue?.message ?? 'Enter a valid password.');
  }

  const allowed = await hasPasswordRecoveryCookie();
  if (!allowed) {
    return failWith(
      AUTH_ERROR_CODES.recoveryInvalid,
      'This reset link is invalid or has expired. Request a new password reset email.',
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await clearPasswordRecoveryCookie();
      return fail(createSessionExpiredError());
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) {
      return fail(toAuthError(error));
    }

    await supabase.auth.signOut({ scope: 'global' }).catch(() => undefined);
    await clearPasswordRecoveryCookie();
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error);
    }

    if (isAuthNetworkError(error)) {
      return failWith(ERROR_CODES.network, 'Unable to update your password. Please try again.');
    }

    return fail(toAuthError(error));
  }

  redirect(buildPasswordUpdatedLoginPath(resumePath));
}
