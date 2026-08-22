/**
 * Standardized Supabase error handling.
 *
 * All future modules must pass Supabase errors through these utilities
 * before surfacing anything to users. Raw database errors (constraint
 * names, SQL details) are never shown — they are normalized into a safe,
 * consistent shape.
 *
 * Runtime-agnostic: safe to import from server and client code.
 */

export interface NormalizedError {
  /** Stable machine-readable code, e.g. a Postgres error code or 'unknown'. */
  readonly code: string;
  /** Safe, human-readable message suitable for display to users. */
  readonly message: string;
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/** User-safe messages for common Postgres error codes returned by Supabase. */
const POSTGRES_ERROR_MESSAGES: Record<string, string> = {
  '23P01': 'This vehicle is already booked for the requested dates.',
  '23503': 'This record is linked to other data and cannot be changed this way.',
  '42501': 'You do not have permission to perform this action.',
};

interface SupabaseErrorLike {
  message: string;
  code?: string;
}

function isSupabaseErrorLike(error: unknown): error is SupabaseErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Converts any thrown value (PostgrestError, AuthError, StorageError,
 * plain Error, or unknown) into a `NormalizedError` safe for users.
 */
export function normalizeSupabaseError(error: unknown): NormalizedError {
  if (isSupabaseErrorLike(error)) {
    const code = error.code ?? 'unknown';
    return {
      code,
      message: POSTGRES_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE,
    };
  }
  return { code: 'unknown', message: FALLBACK_MESSAGE };
}

/** Shorthand when only a display message is needed. */
export function getErrorMessage(error: unknown): string {
  return normalizeSupabaseError(error).message;
}
