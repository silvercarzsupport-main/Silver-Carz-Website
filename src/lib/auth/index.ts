import 'server-only';

/**
 * Server entry point for authentication and authorization infrastructure.
 *
 * Import session helpers and guards from here in Server Components,
 * Server Actions, and Route Handlers:
 *
 *   import { getCurrentUser, requireAuth, requireRole, signOut } from '@/lib/auth'
 *
 * Client Components must import shared utilities from specific modules
 * (those files are not `server-only`):
 *
 *   import { toAuthError } from '@/lib/auth/errors'
 *   import { isPublicRoute } from '@/lib/auth/route-guards'
 *   import { hasRole, isOwner } from '@/lib/auth/authorization'
 *   import type { AuthUser, UserProfile } from '@/lib/auth/types'
 */

export { can, hasRole, isCustomer, isManager, isOwner, isStaff } from './authorization';

export {
  AUTH_ERROR_CODES,
  createForbiddenError,
  createInactiveAccountError,
  createMissingProfileError,
  createSessionExpiredError,
  createUnauthenticatedError,
  getAuthErrorMessage,
  getAuthErrorMessageForCode,
  toAuthError,
  type AuthErrorCode,
} from './errors';

export { getPermissionsForRole, hasPermission, PERMISSIONS, type Permission } from './permissions';

export {
  createDatabaseSetupRequiredError,
  ensureCurrentProfile,
  getCurrentProfile,
  getProfileById,
  toAuthUserFromProfile,
  toUserProfile,
} from './profile';

export {
  requireAuth,
  requireCustomerAuth,
  requirePermission,
  requireProfile,
  requireRole,
  requireStaffAuth,
  requireUser,
} from './require-auth';

export {
  APP_ROLE_LABELS,
  APP_ROLE_VALUES,
  APP_ROLES,
  isAppRole,
  isStaffRole,
  STAFF_ROLES,
  type AppRole,
  type StaffRole,
} from './roles';

export {
  allowsRouteAccess,
  buildCustomerLoginRedirectPath,
  buildLoginRedirectPath,
  getRouteAccess,
  isAdminAuthRoute,
  isAdminRoute,
  isAuthCallbackRoute,
  isAuthRoute,
  isCustomerAccountRoute,
  isCustomerAuthRoute,
  isCustomerProtectedRoute,
  isProtectedRoute,
  isPublicRoute,
  isSafeCustomerRedirectPath,
  resolveCustomerPostLoginPath,
  resolvePostLoginPath,
  type RouteAccess,
} from './route-guards';

export {
  getAuthState,
  getCurrentSession,
  getCurrentUser,
  getCurrentUserRole,
  isAuthenticated,
  toAuthUser,
} from './session';

export {
  buildPasswordResetRedirectTo,
  buildPasswordUpdatedLoginPath,
  PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE,
  PASSWORD_RESET_UPDATED_MESSAGE,
  readRecoveryHash,
  resolveAuthCallbackDestination,
  resolvePublicAppOrigin,
  resolveResumePath,
} from './password-reset';

export {
  clearPasswordRecoveryCookie,
  hasPasswordRecoveryCookie,
  setPasswordRecoveryCookie,
} from './password-reset-cookie';

export { signOut } from './sign-out';

export type { AuthState, AuthUser, UserProfile } from './types';
