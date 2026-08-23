'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { CustomerNavLink } from '@/components/customer/navigation/customer-nav-link';
import { BrandLogo } from '@/components/shared/brand-logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { appConfig, customerMainNavItems } from '@/config';
import { ROUTES } from '@/constants/routes';
import { customerSignOutAction } from '@/features/customer-auth/actions/sign-out';
import { isStaff } from '@/lib/auth/authorization';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Mobile navigation — same four primary pages as desktop.
 * Login / account controls sit outside the primary nav list.
 */
export function CustomerMobileNav({ user }: { user: AuthUser | null }) {
  const [open, setOpen] = useState(false);
  const staffUser = isStaff(user);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-secondary-foreground hover:bg-white/10 hover:text-primary lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="border-secondary bg-secondary text-secondary-foreground"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2.5 text-left text-secondary-foreground">
            <BrandLogo size={32} className="rounded-md" />
            <span>
              <span className="block text-base font-bold tracking-wide uppercase">
                {appConfig.companyName}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
                Self Drive Car Rental
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-4 px-4 pb-6" aria-label="Mobile">
          {customerMainNavItems.map((item) => (
            <CustomerNavLink
              key={`${item.title}-${item.href}`}
              item={item}
              onNavigate={() => setOpen(false)}
              className="py-1"
            />
          ))}
          <Button
            asChild
            className="mt-2 h-11 rounded-md bg-primary font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Link href={ROUTES.bookACar} onClick={() => setOpen(false)}>
              Book Now
            </Link>
          </Button>

          <div className="mt-2 border-t border-white/10 pt-4">
            {user ? (
              <div className="space-y-3">
                <p className="truncate text-sm font-semibold">
                  {user.fullName?.trim() || user.email || 'Account'}
                </p>
                {staffUser ? (
                  <Link
                    href={ROUTES.dashboard}
                    className="block text-sm font-semibold text-primary hover:text-primary/90"
                    onClick={() => setOpen(false)}
                  >
                    Admin dashboard
                  </Link>
                ) : null}
                <Link
                  href={ROUTES.myBookings}
                  className="block text-sm text-secondary-foreground/80 hover:text-primary"
                  onClick={() => setOpen(false)}
                >
                  My Bookings
                </Link>
                <Link
                  href={ROUTES.profile}
                  className="block text-sm text-secondary-foreground/80 hover:text-primary"
                  onClick={() => setOpen(false)}
                >
                  Profile
                </Link>
                <form action={customerSignOutAction}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-10 w-full rounded-md border-white/20 bg-transparent text-secondary-foreground hover:bg-white/10"
                  >
                    Log out
                  </Button>
                </form>
              </div>
            ) : (
              <Button
                asChild
                variant="outline"
                className="h-11 w-full rounded-md border-white/20 bg-transparent font-semibold text-secondary-foreground hover:bg-white/10"
              >
                <Link href={ROUTES.customerLogin} onClick={() => setOpen(false)}>
                  Login
                </Link>
              </Button>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
