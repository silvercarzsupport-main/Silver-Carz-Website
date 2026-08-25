/**
 * Authentication and authorization domain types.
 *
 * Prefer these app-facing shapes over raw Supabase Auth / table rows.
 */

import type { AppRole } from '@/lib/auth/roles';

export type { AppRole } from '@/lib/auth/roles';

/**
 * Authenticated user as consumed by the application.
 * Role and display name come from `profiles` when available.
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string | undefined;
  readonly fullName: string | null;
  readonly role: AppRole | null;
}

/** Application profile row (camelCase) — source of truth for RBAC. */
export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly role: AppRole;
  readonly isActive: boolean;
  readonly phone: string | null;
  readonly whatsappOptIn: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Result of resolving the current auth state on the server. */
export interface AuthState {
  readonly user: AuthUser | null;
  readonly profile: UserProfile | null;
  readonly isAuthenticated: boolean;
}
