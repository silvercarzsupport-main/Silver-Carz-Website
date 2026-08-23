import { MapPin, Shield, Tags, Wrench } from 'lucide-react';
import Link from 'next/link';

import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { ROUTES } from '@/constants/routes';

const ITEMS = [
  {
    icon: Tags,
    title: 'Best Prices',
    description: 'Competitive daily rates on a maintained fleet.',
  },
  {
    icon: Wrench,
    title: 'Well Maintained Cars',
    description: 'Regularly serviced for a safe self-drive experience.',
  },
  {
    icon: MapPin,
    title: 'Flexible Pick-up',
    description: 'Simple booking flow with clear next steps.',
  },
  {
    icon: Shield,
    title: 'Transparent Pricing',
    description: (
      <>
        Clear daily rates and an itemised estimate before you request a booking. Policy-based
        charges are listed in our{' '}
        <Link
          href={`${ROUTES.aboutUs}#terms`}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Terms & Conditions
        </Link>
        .
      </>
    ),
  },
] as const;

export function WhyBookBar({ title }: { readonly title?: string }) {
  return (
    <section
      className="bg-secondary text-secondary-foreground"
      aria-labelledby={title ? 'why-book-heading' : undefined}
    >
      <CustomerContainer className="py-10 lg:py-12">
        {title ? (
          <>
            <h2
              id="why-book-heading"
              className="text-2xl font-bold tracking-tight uppercase sm:text-3xl"
            >
              {title}
            </h2>
            <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          </>
        ) : null}
        <div
          className={
            title
              ? 'mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6'
              : 'grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6'
          }
        >
          {ITEMS.map((item) => (
            <div key={item.title} className="flex min-w-0 gap-3">
              <item.icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-wide uppercase">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-secondary-foreground/70">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CustomerContainer>
    </section>
  );
}
