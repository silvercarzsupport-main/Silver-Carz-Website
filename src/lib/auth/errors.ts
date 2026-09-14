/**
 * Authentication-specific error normalization.
 *
 * Maps Supabase Auth error codes to safe, user-facing messages. Raw Auth
 * API messages are never returned to the UI.
 */

import { AppError, ERROR_CODES } from '@/lib/errors';

export const AUTH_ERROR_CODES = {
  unauthenticated: ERROR_CODES.unauthorized,
  forbidden: ERROR_CODES.forbidden,
  invalidCredentials: 'invalid_credentials',
  emailNotConfirmed: 'email_not_confirmed',
  userAlreadyExists: 'user_already_exists',
  weakPassword: 'weak_password',
  overRequestRateLimit: 'over_request_rate_limit',
  sessionExpired: 'session_expired',
  inactiveAccount: 'inactive_account',
  missingProfile: 'missing_profile',
  databaseSetupRequired: 'database_setup_required',
  recoveryInvalid: 'recovery_invalid',
  unknown: ERROR_CODES.unknown,
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  invalid_grant: 'Invalid email or password.',
  email_not_confirmed: 'Confirm your email address before signing in.',
  user_already_exists: 'An account with this email already exists.',
  email_exists: 'An account with this email already exists.',
  weak_password: 'Password does not meet the security requirements.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  over_email_send_rate_limit: 'Too many email requests. Please wait a moment and try again.',
  session_expired: 'Your session has expired. Please sign in again.',
  session_not_found: 'Your session has expired. Please sign in again.',
  refresh_token_not_found: 'Your session has expired. Please sign in again.',
  refresh_token_already_used: 'Your session has expired. Please sign in again.',
  user_not_found: 'No account was found for these credentials.',
  same_password: 'Choose a password that is different from your current one.',
  inactive_account: 'Your account is inactive. Contact an administrator.',
  missing_profile: 'Your account profile is missing. Contact an administrator.',
  database_setup_required:
    'Database setup is incomplete. Apply the profiles migration in Supabase, then try again.',
  recovery_invalid:
    'This reset link is invalid or has expired. Request a new password reset email.',
};

const FALLBACK_MESSAGE = 'Authentication failed. Please try again.';

interface AuthErrorLike {
  message: string;
  code?: string;
  status?: number;
  name?: string;
}

function isAuthErrorLike(error: unknown): error is AuthErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

function resolveAuthCode(error: AuthErrorLike): string {
  if (error.code && error.code.trim().length > 0) {
    return error.code;
  }

  const normalized = error.message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return AUTH_ERROR_CODES.invalidCredentials;
  }
  if (normalized.includes('email not confirmed')) {
    return AUTH_ERROR_CODES.emailNotConfirmed;
  }
  if (normalized.includes('user already registered')) {
    return AUTH_ERROR_CODES.userAlreadyExists;
  }
  if (normalized.includes('rate limit')) {
    return AUTH_ERROR_CODES.overRequestRateLimit;
  }

  return AUTH_ERROR_CODES.unknown;
}

/** Converts an unknown Auth failure into a typed, user-safe `AppError`. */
export function toAuthError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isAuthErrorLike(error)) {
    const code = resolveAuthCode(error);
    const message = AUTH_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
    return new AppError(message, code, { cause: error });
  }

  return new AppError(FALLBACK_MESSAGE, AUTH_ERROR_CODES.unknown, { cause: error });
}

/** Shorthand when only a display message is needed. */
export function getAuthErrorMessage(error: unknown): string {
  return toAuthError(error).message;
}

export function createUnauthenticatedError(
  message = 'You must be signed in to continue.',
): AppError {
  return new AppError(message, AUTH_ERROR_CODES.unauthenticated);
}

export function createForbiddenError(
  message = 'You do not have permission to perform this action.',
): AppError {
  return new AppError(message, AUTH_ERROR_CODES.forbidden);
}

export function createInactiveAccountError(
  message = AUTH_ERROR_MESSAGES.inactive_account,
): AppError {
  return new AppError(message, AUTH_ERROR_CODES.inactiveAccount);
}

export function createMissingProfileError(message = AUTH_ERROR_MESSAGES.missing_profile): AppError {
  return new AppError(message, AUTH_ERROR_CODES.missingProfile);
}

export function createSessionExpiredError(message = AUTH_ERROR_MESSAGES.session_expired): AppError {
  return new AppError(message, AUTH_ERROR_CODES.sessionExpired);
}

/** Safe message for a known auth error code (e.g. login `?reason=`). */
export function getAuthErrorMessageForCode(code: string): string | undefined {
  return AUTH_ERROR_MESSAGES[code];
}
