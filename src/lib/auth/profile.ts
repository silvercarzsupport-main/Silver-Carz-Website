import 'server-only';

/**
 * Profile loading and mapping.
 *
 * Profiles are the source of truth for role and active status.
 * Rows are created by the `handle_new_user` database trigger, and
 * `ensureCurrentProfile` covers Auth Dashboard users if a row is missing.
 *
 * Public signups become `customer` unless the email is in `staff_allowlist`.
 */

import { cache } from 'react';

import { AUTH_ERROR_CODES, createMissingProfileError } from '@/lib/auth/errors';
import { isAppRole } from '@/lib/auth/roles';
import type { AuthUser, UserProfile } from '@/lib/auth/types';
import { AppError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

const PROFILE_COLUMNS =
  'id, email, full_name, role, is_active, phone, whatsapp_opt_in, created_at, updated_at' as const;

type ProfileRow = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'email'
  | 'full_name'
  | 'role'
  | 'is_active'
  | 'phone'
  | 'whatsapp_opt_in'
  | 'created_at'
  | 'updated_at'
>;

const SCHEMA_MISSING_CODES = new Set(['PGRST205', '42P01']);

function isSchemaMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code && SCHEMA_MISSING_CODES.has(error.code)) {
    return true;
  }

  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes("could not find the table 'public.profiles'") ||
    message.includes('schema cache')
  );
}

export function createDatabaseSetupRequiredError(): AppError {
  return new AppError(
    'Database setup is incomplete. Apply the profiles migration in Supabase, then try again.',
    AUTH_ERROR_CODES.databaseSetupRequired,
  );
}

/** Maps a `profiles` row into the app-facing `UserProfile` shape. */
export function toUserProfile(row: ProfileRow): UserProfile | null {
  if (!isAppRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    phone: row.phone,
    whatsappOptIn: row.whatsapp_opt_in,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Builds an `AuthUser` from a validated profile. */
export function toAuthUserFromProfile(profile: UserProfile): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
  };
}

/**
 * Loads the profile for `userId`, or `null` when missing / unreadable.
 * Does not throw — callers that need a hard failure use `ensureCurrentProfile`.
 * Cached per request so layout + permission checks share one profile read.
 */
export const getProfileById = cache(async (userId: string): Promise<UserProfile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toUserProfile(data);
});

/**
 * Returns the profile for the current authenticated user, or `null`.
 * Requires a valid session (RLS: own row / staff select).
 * Prefer `getAuthState()` when both user and profile are needed.
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  return getProfileById(user.id);
}

/**
 * Returns the current profile, creating it via `ensure_own_profile` when missing.
 * Use after a successful sign-in so Auth Dashboard users get a row.
 */
export async function ensureCurrentProfile(): Promise<UserProfile> {
  const existing = await getCurrentProfile();
  if (existing) {
    return existing;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('ensure_own_profile');

  if (isSchemaMissingError(error)) {
    throw createDatabaseSetupRequiredError();
  }

  if (error || !data) {
    // Table may exist but RPC not migrated yet — surface a setup error when
    // the function is missing; otherwise treat as a missing profile.
    if (error?.code === 'PGRST202' || error?.message?.includes('ensure_own_profile')) {
      throw createDatabaseSetupRequiredError();
    }
    throw createMissingProfileError();
  }

  const profile = toUserProfile(data);
  if (!profile) {
    throw createMissingProfileError();
  }

  return profile;
}
