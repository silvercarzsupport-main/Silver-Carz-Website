import type { Metadata } from 'next';

import { appConfig } from '@/config';
import { CustomerAuthPanel } from '@/features/customer-auth/components/customer-auth-panel';
import { CustomerForgotPasswordForm } from '@/features/customer-auth/components/customer-forgot-password-form';
import { AUTH_ERROR_CODES, getAuthErrorMessageForCode } from '@/lib/auth/errors';
import { isSafeCustomerRedirectPath } from '@/lib/auth/route-guards';

export const metadata: Metadata = {
  title: `Forgot password | ${appConfig.companyName}`,
  description: 'Reset your Silver Carz account password.',
};

interface ForgotPasswordPageProps {
  searchParams: Promise<{
    next?: string | string[];
    reason?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function resolveResumePathParam(nextPath: string | undefined): string | undefined {
  if (!nextPath || !isSafeCustomerRedirectPath(nextPath)) {
    return undefined;
  }

  return nextPath;
}

function resolveInitialError(reason: string | undefined): string | undefined {
  if (reason === AUTH_ERROR_CODES.recoveryInvalid) {
    return getAuthErrorMessageForCode(reason);
  }

  return undefined;
}

/** Customer forgot-password — email a recovery link. Stay reachable while signed in. */
export default async function CustomerForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const resumePath = resolveResumePathParam(firstParam(params.next));
  const reason = firstParam(params.reason);

  return (
    <CustomerAuthPanel
      title="Forgot password"
      description="Enter the email on your Silver Carz account. We'll send a link to choose a new password."
    >
      <CustomerForgotPasswordForm
        resumePath={resumePath}
        initialError={resolveInitialError(reason)}
      />
    </CustomerAuthPanel>
  );
}
