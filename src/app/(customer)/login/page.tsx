import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { appConfig } from '@/config';
import { CustomerAuthPanel } from '@/features/customer-auth/components/customer-auth-panel';
import { CustomerLoginForm } from '@/features/customer-auth/components/customer-login-form';
import { getAuthState, resolveCustomerPostLoginPath } from '@/lib/auth';
import { AUTH_ERROR_CODES, getAuthErrorMessageForCode } from '@/lib/auth/errors';
import {
  hasPasswordRecoveryQuery,
  PASSWORD_RESET_UPDATED_MESSAGE,
} from '@/lib/auth/password-reset';

export const metadata: Metadata = {
  title: `Login | ${appConfig.companyName}`,
  description: 'Sign in to continue your Silver Carz booking.',
};

interface CustomerLoginPageProps {
  searchParams: Promise<{
    next?: string | string[];
    reason?: string | string[];
    reset?: string | string[];
    code?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function resolveInitialError(reason: string | undefined): string | undefined {
  if (!reason) {
    return undefined;
  }

  if (
    reason === AUTH_ERROR_CODES.sessionExpired ||
    reason === AUTH_ERROR_CODES.inactiveAccount ||
    reason === AUTH_ERROR_CODES.missingProfile ||
    reason === AUTH_ERROR_CODES.databaseSetupRequired
  ) {
    return getAuthErrorMessageForCode(reason);
  }

  return undefined;
}

/** Customer login — functional auth route (not a primary nav page). */
export default async function CustomerLoginPage({ searchParams }: CustomerLoginPageProps) {
  const params = await searchParams;
  const nextPath = firstParam(params.next);
  const reason = firstParam(params.reason);
  const reset = firstParam(params.reset);

  const { user, profile } = await getAuthState();
  if (user && profile?.isActive && !hasPasswordRecoveryQuery(params)) {
    redirect(resolveCustomerPostLoginPath(nextPath));
  }

  return (
    <CustomerAuthPanel
      title="Welcome back"
      description="Log in to continue your booking. Your selected car stays with you."
    >
      <CustomerLoginForm
        nextPath={nextPath}
        initialError={resolveInitialError(reason)}
        initialSuccess={reset === 'success' ? PASSWORD_RESET_UPDATED_MESSAGE : undefined}
      />
    </CustomerAuthPanel>
  );
}
