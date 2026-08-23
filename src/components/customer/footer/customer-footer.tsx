import Link from 'next/link';

import { BrandLogo } from '@/components/shared/brand-logo';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { appConfig, customerLegalNavItems, customerQuickLinkItems } from '@/config';
import { ROUTES } from '@/constants/routes';

/**
 * Customer portal footer — company identity + the four primary pages.
 */
export function CustomerFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-secondary text-secondary-foreground">
      <CustomerContainer className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 lg:py-14">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href={ROUTES.home} className="inline-flex items-center gap-3">
            <BrandLogo size={44} className="rounded-lg" />
            <span>
              <span className="block text-lg font-bold tracking-wide uppercase">
                {appConfig.companyName}
                <span className="text-primary">.</span>
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
                Self Drive Car Rental
              </span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-secondary-foreground/70">
            {appConfig.companyName} provides self-drive car rental for customers who want a reliable
            fleet and a simple booking experience.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold tracking-wide text-primary uppercase">Quick Links</h2>
          <ul className="mt-4 space-y-2.5">
            {customerQuickLinkItems.map((item) => (
              <li key={`quick-${item.href}-${item.title}`}>
                <Link
                  href={item.href}
                  className="text-sm text-secondary-foreground/80 transition-colors hover:text-primary"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold tracking-wide text-primary uppercase">Follow Us</h2>
          <p className="mt-4 text-sm text-secondary-foreground/70">Social links coming soon.</p>
        </div>
      </CustomerContainer>

      <div className="border-t border-white/10">
        <CustomerContainer className="flex flex-col gap-3 py-4 text-xs text-secondary-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {appConfig.companyName}. All Rights Reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {customerLegalNavItems.map((item, index) => (
              <span key={item.title} className="inline-flex items-center gap-3">
                {index > 0 ? <span aria-hidden="true">|</span> : null}
                <Link href={item.href} className="transition-colors hover:text-primary">
                  {item.title}
                </Link>
              </span>
            ))}
          </div>
        </CustomerContainer>
      </div>
    </footer>
  );
}
