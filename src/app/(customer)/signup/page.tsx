import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { appConfig } from '@/config';
import { CustomerAuthPanel } from '@/features/customer-auth/components/customer-auth-panel';
import { CustomerSignupForm } from '@/features/customer-auth/components/customer-signup-form';
import { getAuthState, resolveCustomerPostLoginPath } from '@/lib/auth';
import { hasPasswordRecoveryQuery } from '@/lib/auth/password-reset';

export const metadata: Metadata = {
  title: `Sign Up | ${appConfig.companyName}`,
  description: 'Create a Silver Carz customer account to continue booking.',
};

interface CustomerSignupPageProps {
  searchParams: Promise<{
    next?: string | string[];
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

/** Customer signup — functional auth route (not a primary nav page). */
export default async function CustomerSignupPage({ searchParams }: CustomerSignupPageProps) {
  const params = await searchParams;
  const nextPath = firstParam(params.next);

  const { user, profile } = await getAuthState();
  if (user && profile?.isActive && !hasPasswordRecoveryQuery(params)) {
    redirect(resolveCustomerPostLoginPath(nextPath));
  }

  return (
    <CustomerAuthPanel
      title="Create account"
      description="Sign up to continue booking. We’ll keep your selected car ready."
    >
      <CustomerSignupForm nextPath={nextPath} />
    </CustomerAuthPanel>
  );
}
