import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandLogo } from '@/components/shared/brand-logo';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { appConfig } from '@/config';
import { ROUTES } from '@/constants/routes';

interface CustomerAuthPanelProps {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

/**
 * Shared customer auth chrome — premium yellow/black branding, not admin UI.
 */
export function CustomerAuthPanel({ title, description, children }: CustomerAuthPanelProps) {
  return (
    <section className="relative flex flex-1 flex-col justify-center overflow-hidden py-10 sm:py-14">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(244_180_0_/_0.14),_transparent_55%),linear-gradient(180deg,_#FAFAFA_0%,_#FFFFFF_45%,_#F4F4F4_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary"
        aria-hidden="true"
      />

      <CustomerContainer className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href={ROUTES.home} className="inline-flex flex-col items-center">
            <BrandLogo size={56} className="mb-3 rounded-xl" />
            <span className="block text-2xl font-bold tracking-wide text-foreground uppercase sm:text-3xl">
              {appConfig.companyName}
              <span className="text-primary">.</span>
            </span>
            <span className="mt-1 block text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Self Drive Car Rental
            </span>
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-foreground uppercase sm:text-2xl">
              {title}
            </h1>
            <div className="mt-2 h-1 w-12 bg-primary" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </CustomerContainer>
    </section>
  );
}
