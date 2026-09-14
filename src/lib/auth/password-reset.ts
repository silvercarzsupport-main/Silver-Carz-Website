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
const LOCAL_LOOPBACK_ORIGIN = 'http://127.0.0.1:3000';

function parseHttpOrigin(value: string | undefined, allowBareHost = false): string | null {
  const trimmed = value?.trim().replace(/\/$/, '') ?? '';
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : allowBareHost
      ? `https://${trimmed}`
      : '';

  if (!withProtocol) {
    return null;
  }

  try {
    const url = new URL(withProtocol);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

function firstSearchValue(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (typeof (params as URLSearchParams).get === 'function') {
    return (params as URLSearchParams).get(key);
  }

  const value = (params as Record<string, string | string[] | undefined>)[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

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
 * Prefers NEXT_PUBLIC_APP_URL, then Vercel URLs, then localhost.
 */
export function resolvePublicAppOrigin(
  envUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
  vercelProductionUrl: string | undefined = process.env.VERCEL_PROJECT_PRODUCTION_URL,
  vercelUrl: string | undefined = process.env.VERCEL_URL,
): string {
  return (
    parseHttpOrigin(envUrl) ??
    parseHttpOrigin(vercelProductionUrl, true) ??
    parseHttpOrigin(vercelUrl, true) ??
    LOCAL_DEV_ORIGIN
  );
}

export function isAllowedAppOrigin(
  origin: string,
  envUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
  vercelProductionUrl: string | undefined = process.env.VERCEL_PROJECT_PRODUCTION_URL,
  vercelUrl: string | undefined = process.env.VERCEL_URL,
): boolean {
  const configured = resolvePublicAppOrigin(envUrl, vercelProductionUrl, vercelUrl);
  const allowed = new Set(
    [
      configured,
      LOCAL_DEV_ORIGIN,
      LOCAL_LOOPBACK_ORIGIN,
      parseHttpOrigin(vercelProductionUrl, true),
      parseHttpOrigin(vercelUrl, true),
    ].filter((value): value is string => Boolean(value)),
  );

  return allowed.has(origin);
}

type HeaderReader = {
  get(name: string): string | null;
};

/**
 * Origin for this request, if it matches a known app host.
 * Stops Host-header open redirects while still using localhost vs production correctly.
 */
export function resolveRequestAppOrigin(
  headerList: HeaderReader,
  envUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
  vercelProductionUrl: string | undefined = process.env.VERCEL_PROJECT_PRODUCTION_URL,
  vercelUrl: string | undefined = process.env.VERCEL_URL,
): string {
  const configured = resolvePublicAppOrigin(envUrl, vercelProductionUrl, vercelUrl);
  const host =
    (headerList.get('x-forwarded-host') ?? headerList.get('host') ?? '').split(',')[0]?.trim() ??
    '';
  const forwardedProto = (headerList.get('x-forwarded-proto') ?? '')
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  const proto =
    forwardedProto === 'http' || forwardedProto === 'https'
      ? forwardedProto
      : host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : 'https';

  if (!host) {
    return configured;
  }

  const origin = parseHttpOrigin(`${proto}://${host}`);
  if (origin && isAllowedAppOrigin(origin, envUrl, vercelProductionUrl, vercelUrl)) {
    return origin;
  }

  return configured;
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
 * Must match a Redirect URL path with no extra query string — otherwise
 * Auth falls back to Site URL (the homepage).
 */
export function buildPasswordResetRedirectTo(origin: string, resumePath?: string | null): string {
  const url = new URL(ROUTES.customerResetPassword, `${origin}/`);
  const resume = resolveResumePath(resumePath);
  if (resume) {
    url.searchParams.set('resume', resume);
  }

  return url.toString();
}

export function shouldMarkPasswordRecovery(input: {
  readonly type: string | null;
  readonly next: string | null;
  readonly destination: string;
}): boolean {
  const pathname = input.destination.split('?')[0] ?? input.destination;
  return (
    input.type === 'recovery' ||
    input.next === ROUTES.customerResetPassword ||
    pathname === ROUTES.customerResetPassword
  );
}

/** True when query params still carry a recovery `code`, OTP, or `type=recovery`. */
export function hasPasswordRecoveryQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): boolean {
  return (
    Boolean(firstSearchValue(params, 'code')) ||
    Boolean(firstSearchValue(params, 'token_hash')) ||
    firstSearchValue(params, 'type') === 'recovery'
  );
}

/** True when the current URL still carries a recovery `code`, OTP, or hash. */
export function hasPasswordRecoveryParams(search: string, hash: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (hasPasswordRecoveryQuery(params)) {
    return true;
  }

  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) {
    return false;
  }

  const hashParams = new URLSearchParams(raw);
  return hashParams.get('type') === 'recovery' || readRecoveryHash(hash) !== null;
}

const RECOVERY_HANDLED_PATHS = new Set<string>([ROUTES.authCallback, ROUTES.customerResetPassword]);

/**
 * Server/proxy redirect when Auth dropped a recovery `code` on Site URL (home).
 * Hash tokens are not visible here — the client catcher handles those.
 */
export function buildPasswordRecoveryProxyHref(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  if (RECOVERY_HANDLED_PATHS.has(pathname) || !hasPasswordRecoveryQuery(searchParams)) {
    return null;
  }

  const params = new URLSearchParams(
    typeof searchParams.toString === 'function' ? searchParams.toString() : '',
  );
  if (params.get('code') || params.get('token_hash')) {
    if (!params.get('next')) {
      params.set('next', ROUTES.customerResetPassword);
    }

    return `${ROUTES.authCallback}?${params.toString()}`;
  }

  const query = params.toString();
  return query ? `${ROUTES.customerResetPassword}?${query}` : ROUTES.customerResetPassword;
}

/**
 * If Auth fell back to Site URL (usually `/`), send leftover recovery tokens
 * to `/auth/callback` or `/reset-password` instead of leaving the user on home.
 */
export function buildPasswordRecoveryCatcherHref(
  pathname: string,
  search: string,
  hash: string,
): string | null {
  if (RECOVERY_HANDLED_PATHS.has(pathname)) {
    return null;
  }

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fromQuery = buildPasswordRecoveryProxyHref(pathname, params);
  if (fromQuery) {
    return fromQuery;
  }

  if (!hasPasswordRecoveryParams(search, hash)) {
    return null;
  }

  const query = !search || search.startsWith('?') ? search : `?${search}`;
  const fragment = !hash || hash.startsWith('#') ? hash : `#${hash}`;
  return `${ROUTES.customerResetPassword}${query}${fragment}`;
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
