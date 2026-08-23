import Link from 'next/link';

import { BrandLogo } from '@/components/shared/brand-logo';
import { CustomerMobileNav } from '@/components/customer/navigation/customer-mobile-nav';
import { CustomerNavLink } from '@/components/customer/navigation/customer-nav-link';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { appConfig, customerMainNavItems } from '@/config';
import { ROUTES } from '@/constants/routes';
import { CustomerAccountMenu } from '@/features/customer-auth/components/customer-account-menu';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Customer portal header.
 * Four primary pages + Book Now CTA. Login / account controls are separate
 * from primary navigation.
 */
export function CustomerHeader({ user }: { user: AuthUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-secondary text-secondary-foreground">
      <CustomerContainer className="flex h-16 items-center gap-3 sm:h-[4.25rem]">
        <Link href={ROUTES.home} className="flex min-w-0 shrink-0 items-center gap-2.5">
          <BrandLogo size={40} preload className="rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate text-base font-bold tracking-wide uppercase sm:text-lg">
              {appConfig.companyName}
              <span className="text-primary">.</span>
            </span>
            <span className="mt-0.5 block text-[9px] font-semibold tracking-[0.18em] text-primary uppercase sm:text-[10px]">
              Self Drive Car Rental
            </span>
          </span>
        </Link>

        <nav
          className="mx-auto hidden items-center justify-center gap-5 lg:flex xl:gap-7"
          aria-label="Primary"
        >
          {customerMainNavItems.map((item) => (
            <CustomerNavLink key={`${item.title}-${item.href}`} item={item} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <CustomerAccountMenu user={user} />
          ) : (
            <Button
              asChild
              variant="ghost"
              className="h-10 rounded-md px-3 font-semibold text-secondary-foreground hover:bg-white/10 hover:text-primary"
            >
              <Link href={ROUTES.customerLogin}>Login</Link>
            </Button>
          )}
          <Button
            asChild
            className="hidden h-10 rounded-md bg-primary px-4 font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90 sm:inline-flex"
          >
            <Link href={ROUTES.bookACar}>Book Now</Link>
          </Button>
          <CustomerMobileNav user={user} />
        </div>
      </CustomerContainer>
    </header>
  );
}
