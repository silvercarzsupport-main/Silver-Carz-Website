/**
 * Route classification helpers for authentication and authorization.
 *
 * Path strings come from `ROUTES` — never hardcode auth paths at call sites.
 * Proxy and layouts use these helpers to decide public vs protected access.
 *
 * ---------------------------------------------------------------------------
 * Customer / Admin coexistence
 * ---------------------------------------------------------------------------
 * - One Supabase Auth project serves both portals.
 * - Admin staff (`owner` | `manager`) use `/admin/login` and `/admin/*`.
 * - Customers use `/login` + `/signup` and customer account routes.
 * - `isProtectedRoute` remains **admin-only**. Customer account protection
 *   uses `isCustomerProtectedRoute` — do not redirect customers to admin login.
 */

import { ROUTES, type AppRoute } from '@/constants/routes';
import type { AppRole } from '@/lib/auth/roles';

/** Admin auth screens (reachable without a session). */
const ADMIN_AUTH_ROUTES: readonly AppRoute[] = [
  ROUTES.login,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
] as const;

/** Customer auth screens (reachable without a session). */
const CUSTOMER_AUTH_ROUTES: readonly AppRoute[] = [
  ROUTES.customerLogin,
  ROUTES.customerSignup,
] as const;

/** Auth-facing routes that must stay reachable without a session. */
const PUBLIC_AUTH_ROUTES: readonly AppRoute[] = [
  ...ADMIN_AUTH_ROUTES,
  ...CUSTOMER_AUTH_ROUTES,
] as const;

/** Prefix for Auth callback / confirmation handlers (e.g. `/auth/callback`). */
const AUTH_CALLBACK_PREFIX = '/auth';

/** Admin portal URL prefix. */
const ADMIN_PREFIX = ROUTES.admin;

/**
 * Customer account routes that require a customer session.
 */
const CUSTOMER_ACCOUNT_ROUTES: readonly AppRoute[] = [ROUTES.myBookings, ROUTES.profile] as const;

/** How a route may be accessed. Extend with `permission` when needed. */
export type RouteAccess =
  | { readonly type: 'public' }
  | { readonly type: 'authenticated' }
  | { readonly type: 'roles'; readonly roles: readonly AppRole[] };

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function splitPathAndSearch(pathWithOptionalSearch: string): {
  pathname: string;
  search: string;
} {
  const queryIndex = pathWithOptionalSearch.indexOf('?');
  if (queryIndex === -1) {
    return { pathname: pathWithOptionalSearch, search: '' };
  }

  return {
    pathname: pathWithOptionalSearch.slice(0, queryIndex),
    search: pathWithOptionalSearch.slice(queryIndex),
  };
}

function matchesRoute(pathname: string, route: string): boolean {
  const path = normalizePathname(pathname);
  const base = normalizePathname(route);
  return path === base || path.startsWith(`${base}/`);
}

/** True for paths under the admin portal (`/admin`, `/admin/...`). */
export function isAdminRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`);
}

/** True for admin login / password-reset screens. */
export function isAdminAuthRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return ADMIN_AUTH_ROUTES.some((route) => matchesRoute(path, route));
}

/** True for customer login / signup screens. */
export function isCustomerAuthRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return CUSTOMER_AUTH_ROUTES.some((route) => matchesRoute(path, route));
}

/** True for login, password-reset, and related auth screens (admin or customer). */
export function isAuthRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return PUBLIC_AUTH_ROUTES.some((route) => matchesRoute(path, route));
}

/** True for Supabase Auth callback / confirmation paths under `/auth`. */
export function isAuthCallbackRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === AUTH_CALLBACK_PREFIX || path.startsWith(`${AUTH_CALLBACK_PREFIX}/`);
}

/**
 * True for customer account surfaces that require a session.
 */
export function isCustomerAccountRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return CUSTOMER_ACCOUNT_ROUTES.some((route) => matchesRoute(path, route));
}

/**
 * Customer routes that require a signed-in session.
 * Booking wizard + request detail are gated; account placeholders stay public until later.
 */
export function isCustomerProtectedRoute(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path === ROUTES.bookingContinue || path.startsWith(`${ROUTES.bookingContinue}/`)) {
    return true;
  }

  // /booking/{id} and nested workflow steps (documents / payment / confirmation)
  if (path === '/booking' || path.startsWith('/booking/')) {
    return true;
  }

  if (isCustomerAccountRoute(path)) {
    return true;
  }

  return false;
}

/**
 * Admin routes that require a session.
 * Public site paths and admin auth screens are not protected.
 */
export function isProtectedRoute(pathname: string): boolean {
  return isAdminRoute(pathname) && !isAuthRoute(pathname) && !isAuthCallbackRoute(pathname);
}

/** Inverse of `isProtectedRoute`. */
export function isPublicRoute(pathname: string): boolean {
  return !isProtectedRoute(pathname);
}

/**
 * Default access rule for a pathname.
 * Role-specific maps can be added later without changing call sites.
 */
export function getRouteAccess(pathname: string): RouteAccess {
  if (isPublicRoute(pathname)) {
    return { type: 'public' };
  }

  return { type: 'authenticated' };
}

/**
 * Evaluates whether `role` satisfies a route access rule.
 * `null` role fails authenticated / role-restricted rules.
 */
export function allowsRouteAccess(access: RouteAccess, role: AppRole | null): boolean {
  switch (access.type) {
    case 'public':
      return true;
    case 'authenticated':
      return role !== null;
    case 'roles':
      return role !== null && access.roles.includes(role);
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
}

/**
 * Builds an admin login URL that preserves the intended destination.
 * Used when redirecting unauthenticated users (login UI phase).
 */
export function buildLoginRedirectPath(nextPath?: string): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return ROUTES.login;
  }

  const params = new URLSearchParams({ next: nextPath });
  return `${ROUTES.login}?${params.toString()}`;
}

/**
 * Customer login redirect. Preserves the intended destination via `next`.
 */
export function buildCustomerLoginRedirectPath(nextPath?: string): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return ROUTES.customerLogin;
  }

  const params = new URLSearchParams({ next: nextPath });
  return `${ROUTES.customerLogin}?${params.toString()}`;
}

/**
 * True when a relative path is a safe customer-portal redirect target.
 * Rejects admin routes and external / protocol-relative URLs.
 */
export function isSafeCustomerRedirectPath(nextPath: string): boolean {
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return false;
  }

  const { pathname } = splitPathAndSearch(nextPath);
  const path = normalizePathname(pathname);

  if (isAdminRoute(path)) {
    return false;
  }

  if (path === ROUTES.home) {
    return true;
  }

  const allowedExact: readonly string[] = [
    ROUTES.carDetailing,
    ROUTES.aboutUs,
    ROUTES.customerLogin,
    ROUTES.customerSignup,
    ROUTES.myBookings,
    ROUTES.profile,
    ROUTES.bookingContinue,
  ];

  if (allowedExact.some((route) => path === route)) {
    return true;
  }

  // Future booking flow steps under /booking/*
  if (path === '/booking' || path.startsWith('/booking/')) {
    return true;
  }

  return false;
}

/**
 * Safe post-login destination for the Admin Portal.
 * Rejects open redirects by requiring a same-origin relative path under a
 * protected admin route.
 */
export function resolvePostLoginPath(nextPath: string | null | undefined): AppRoute | string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return ROUTES.dashboard;
  }

  if (!isProtectedRoute(nextPath.split('?')[0] ?? nextPath)) {
    return ROUTES.dashboard;
  }

  return nextPath;
}

/**
 * Safe post-login destination for the customer portal.
 * Defaults to Book a Car (`/`). Never redirects into `/admin/*`.
 */
export function resolveCustomerPostLoginPath(nextPath: string | null | undefined): string {
  if (!nextPath || !isSafeCustomerRedirectPath(nextPath)) {
    return ROUTES.home;
  }

  return nextPath;
}
