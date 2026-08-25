import type { Metadata } from 'next';
import Link from 'next/link';

import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { appConfig } from '@/config';
import { ROUTES } from '@/constants/routes';
import { CustomerNotificationPreferencesForm } from '@/features/customer-profile';
import { APP_ROLES, getCurrentProfile, isStaff, requireCustomerAuth } from '@/lib/auth';

export const metadata: Metadata = {
  title: `Profile | ${appConfig.companyName}`,
  description: 'Manage how Silver Carz sends booking updates.',
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireCustomerAuth(ROUTES.profile);

  if (user.role !== APP_ROLES.customer) {
    return (
      <CustomerContainer className="max-w-2xl py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">Profile</h1>
        <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
        <p className="mt-5 text-muted-foreground">
          Staff accounts are managed in the Admin Portal.
        </p>
        {isStaff(user) ? (
          <div className="mt-8">
            <Button asChild className="h-11 rounded-md bg-primary font-bold uppercase">
              <Link href={ROUTES.dashboard}>Admin dashboard</Link>
            </Button>
          </div>
        ) : null}
      </CustomerContainer>
    );
  }

  const profile = await getCurrentProfile();

  return (
    <CustomerContainer className="max-w-2xl py-10 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        Account
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground uppercase">Profile</h1>
      <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
      <p className="mt-5 text-base leading-relaxed text-muted-foreground">
        Choose how you receive booking request, approval, payment, and cancellation messages.
      </p>
      <div className="mt-8">
        <CustomerNotificationPreferencesForm
          email={profile?.email ?? user.email ?? ''}
          initialPhone={profile?.phone ?? null}
          initialWhatsAppOptIn={profile?.whatsappOptIn ?? false}
        />
      </div>
    </CustomerContainer>
  );
}
