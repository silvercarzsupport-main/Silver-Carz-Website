'use server';

/**
 * Sends a customer password-reset email via Supabase Auth.
 *
 * Always returns the same success copy unless the request is rate-limited or
 * the email is invalid — never reveal whether an account exists.
 */

import { resetPasswordRequestSchema } from '@/features/customer-auth/validations/credentials';
import { AUTH_ERROR_CODES, toAuthError } from '@/lib/auth/errors';
import {
  buildPasswordResetRedirectTo,
  isAuthNetworkError,
  isVisiblePasswordResetRequestError,
  resolvePublicAppOrigin,
} from '@/lib/auth/password-reset';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fail, failWith, ok } from '@/services';
import type { ApiResponse } from '@/types';

export type RequestPasswordResetActionResult = ApiResponse<{ readonly sent: true }>;

export async function requestPasswordResetAction(
  email: string,
  resumePath?: string | null,
): Promise<RequestPasswordResetActionResult> {
  const parsed = resetPasswordRequestSchema.safeParse({ email });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return failWith(ERROR_CODES.validation, firstIssue?.message ?? 'Enter a valid email address.');
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: buildPasswordResetRedirectTo(resolvePublicAppOrigin(), resumePath),
    });

    if (error) {
      const authError = toAuthError(error);
      if (isVisiblePasswordResetRequestError(authError.code)) {
        return fail(authError);
      }

      console.error('[customer-auth] password reset request failed', authError.code);
    }

    return ok({ sent: true });
  } catch (error) {
    if (isAuthNetworkError(error)) {
      return failWith(ERROR_CODES.network, 'Unable to send a reset email. Please try again.');
    }

    if (error instanceof AppError && error.code === AUTH_ERROR_CODES.overRequestRateLimit) {
      return fail(error);
    }

    console.error('[customer-auth] password reset request failed', error);
    return ok({ sent: true });
  }
}
