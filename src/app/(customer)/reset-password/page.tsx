import type { Metadata } from 'next';

import { appConfig } from '@/config';
import { CustomerAuthPanel } from '@/features/customer-auth/components/customer-auth-panel';
import { CustomerResetPasswordView } from '@/features/customer-auth/components/customer-reset-password-form';
import { getAuthState } from '@/lib/auth';
import { hasPasswordRecoveryCookie } from '@/lib/auth/password-reset-cookie';
import { isSafeCustomerRedirectPath } from '@/lib/auth/route-guards';

export const metadata: Metadata = {
  title: `Reset password | ${appConfig.companyName}`,
  description: 'Choose a new password for your Silver Carz account.',
};

interface ResetPasswordPageProps {
  searchParams: Promise<{
    resume?: string | string[];
    next?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function resolveResumePathParam(value: string | undefined): string | undefined {
  if (!value || !isSafeCustomerRedirectPath(value)) {
    return undefined;
  }

  return value;
}

/** Customer reset-password — requires a recovery session from the email link. */
export default async function CustomerResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const resumePath = resolveResumePathParam(firstParam(params.resume) ?? firstParam(params.next));

  const [{ user }, recovery] = await Promise.all([getAuthState(), hasPasswordRecoveryCookie()]);
  const canUpdate = Boolean(user && recovery);

  return (
    <CustomerAuthPanel
      title="Set a new password"
      description="Choose a strong password for your Silver Carz account. You'll sign in again after it is saved."
    >
      <CustomerResetPasswordView canUpdate={canUpdate} resumePath={resumePath} />
    </CustomerAuthPanel>
  );
}
