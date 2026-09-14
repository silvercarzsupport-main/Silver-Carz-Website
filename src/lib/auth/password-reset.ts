/**
 * Pure helpers for the customer password-reset flow.
 *
 * Keep this module free of `server-only` so UI, the auth callback, and tests
 * can share the same redirect / origin / hash parsing rules.
 */

import { PASSWORD_RECOVERY_COOKIE_MAX_AGE, ROUTES } from '@/constants';
import { isSafeCustomerRedirectPath } from '@/lib/auth/route-guards';

export const PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE =
  'If an account exists for that email, we sent a reset link. Check your inbox and spam folder.';

export const PASSWORD_RESET_UPDATED_MESSAGE =
  'Your password has been updated. Sign in with your new password.';

const LOCAL_DEV_ORIGIN = 'http://localhost:3000';

export type RecoveryHashTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
};

export function getPasswordRecoveryCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: PASSWORD_RECOVERY_COOKIE_MAX_AGE,
  };
}

/**
 * Public site origin used in reset emails (`redirectTo`).
 * Never derived from the Host header — that would allow open redirects.
 */
export function resolvePublicAppOrigin(
  envUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
): string {
  const trimmed = envUrl?.trim().replace(/\/$/, '') ?? '';

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.origin;
    }
  } catch {
    // fall through
  }

  return LOCAL_DEV_ORIGIN;
}

/** Safe post-reset login destination (customer portal only). */
export function resolveResumePath(resumePath: string | null | undefined): string | undefined {
  if (!resumePath || !isSafeCustomerRedirectPath(resumePath)) {
    return undefined;
  }

  return resumePath;
}

/**
 * `redirectTo` baked into the Supabase recovery email.
 * Lands on `/auth/callback` so PKCE `code` and `token_hash` can be exchanged.
 */
export function buildPasswordResetRedirectTo(origin: string, resumePath?: string | null): string {
  const url = new URL(ROUTES.authCallback, `${origin}/`);
  url.searchParams.set('next', ROUTES.customerResetPassword);

  const resume = resolveResumePath(resumePath);
  if (resume) {
    url.searchParams.set('resume', resume);
  }

  return url.toString();
}

function withResume(pathname: string, resume: string | undefined): string {
  if (!resume) {
    return pathname;
  }

  const params = new URLSearchParams({ resume });
  return `${pathname}?${params.toString()}`;
}

/**
 * Safe path after exchanging a recovery / confirm token.
 * Rejects open redirects and keeps recovery traffic on the reset form.
 */
export function resolveAuthCallbackDestination(input: {
  readonly next: string | null;
  readonly resume: string | null;
  readonly type: string | null;
  readonly error: string | null;
}): string {
  if (input.error) {
    return `${ROUTES.customerForgotPassword}?reason=recovery_invalid`;
  }

  const resume = resolveResumePath(input.resume);
  const type = input.type?.trim().toLowerCase() ?? '';

  if (type === 'signup' || type === 'email' || type === 'magiclink' || type === 'invite') {
    return ROUTES.customerLogin;
  }

  if (type === 'email_change') {
    return ROUTES.profile;
  }

  if (type === 'recovery' || input.next === ROUTES.customerResetPassword || type.length === 0) {
    return withResume(ROUTES.customerResetPassword, resume);
  }

  if (input.next && isSafeCustomerRedirectPath(input.next)) {
    return input.next;
  }

  return withResume(ROUTES.customerResetPassword, resume);
}

/** Login URL after a successful password update. */
export function buildPasswordUpdatedLoginPath(resumePath?: string | null): string {
  const params = new URLSearchParams({ reset: 'success' });
  const resume = resolveResumePath(resumePath);
  if (resume) {
    params.set('next', resume);
  }

  return `${ROUTES.customerLogin}?${params.toString()}`;
}

/**
 * Implicit-flow recovery tokens arrive in the URL hash (not sent to the server).
 */
export function readRecoveryHash(hash: string): RecoveryHashTokens | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) {
    return null;
  }

  const params = new URLSearchParams(raw);
  const type = params.get('type');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (type !== 'recovery' || !accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

export function isAuthNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message: unknown }).message).toLowerCase();
    return message.includes('fetch failed') || message.includes('network');
  }

  return false;
}

/** True when an Auth error should be shown instead of the generic “email sent” copy. */
export function isVisiblePasswordResetRequestError(code: string | undefined): boolean {
  return (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    code === 'validation'
  );
}
