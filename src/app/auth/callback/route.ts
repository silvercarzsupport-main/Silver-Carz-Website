import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { ROUTES, STORAGE_KEYS } from '@/constants';
import { setPasswordRecoveryCookie } from '@/lib/auth/password-reset-cookie';
import {
  getPasswordRecoveryCookieOptions,
  resolveAuthCallbackDestination,
} from '@/lib/auth/password-reset';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function firstParam(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isRecoveryExchange(type: string | null, next: string | null): boolean {
  return type === 'recovery' || next === ROUTES.customerResetPassword;
}

function attachRecoveryCookie(response: NextResponse): NextResponse {
  response.cookies.set(
    STORAGE_KEYS.passwordRecovery,
    '1',
    getPasswordRecoveryCookieOptions(process.env.NODE_ENV === 'production'),
  );
  return response;
}

/**
 * Exchanges Supabase Auth PKCE `code` or email `token_hash` for a session.
 * Recovery exchanges also set a short-lived cookie required to update the password.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = firstParam(searchParams.get('code'));
  const tokenHash = firstParam(searchParams.get('token_hash'));
  const type = firstParam(searchParams.get('type'));
  const next = firstParam(searchParams.get('next'));
  const resume = firstParam(searchParams.get('resume'));
  const errorParam = firstParam(searchParams.get('error'));

  const destination = resolveAuthCallbackDestination({
    next,
    resume,
    type,
    error: errorParam,
  });
  const redirectUrl = new URL(destination, origin);

  if (errorParam) {
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createSupabaseServerClient();
  let exchanged = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchanged = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    exchanged = !error;
  }

  if (!exchanged) {
    const failed = new URL(ROUTES.customerForgotPassword, origin);
    failed.searchParams.set('reason', 'recovery_invalid');
    return NextResponse.redirect(failed);
  }

  const response = NextResponse.redirect(redirectUrl);

  if (isRecoveryExchange(type, next)) {
    await setPasswordRecoveryCookie();
    attachRecoveryCookie(response);
  }

  return response;
}
