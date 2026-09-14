import type { ReactNode } from 'react';

import { CustomerFooter } from '@/components/customer/footer/customer-footer';
import { CustomerHeader } from '@/components/customer/header/customer-header';
import { PasswordRecoveryRedirectCatcher } from '@/components/customer/layout/password-recovery-redirect-catcher';
import { PortalThemeScope } from '@/components/shared/portal-theme-scope';
import { getAuthState } from '@/lib/auth';

/**
 * Customer portal chrome — header, main, footer.
 * Applies the customer token scope without touching the Admin shell.
 * Loads session on the server so Login / Account UI does not flash incorrectly.
 */
export async function CustomerShell({ children }: { children: ReactNode }) {
  const { user, profile } = await getAuthState();
  const activeUser = user && profile?.isActive ? user : null;

  return (
    <div data-portal="customer" className="flex min-h-svh flex-col bg-background text-foreground">
      <PortalThemeScope portal="customer" />
      <PasswordRecoveryRedirectCatcher />
      <CustomerHeader user={activeUser} />
      <main className="flex flex-1 flex-col">{children}</main>
      <CustomerFooter />
    </div>
  );
}
