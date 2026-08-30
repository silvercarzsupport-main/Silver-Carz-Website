import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlarmClock,
  BadgeCheck,
  Ban,
  CarFront,
  Clock,
  Cigarette,
  Droplets,
  FileText,
  Fuel,
  Gauge,
  Receipt,
  Satellite,
  ShieldAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { WhyBookBar } from '@/components/customer/book-a-car/why-book-bar';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { BrandLogo } from '@/components/shared/brand-logo';
import { appConfig } from '@/config';
import { ROUTES } from '@/constants/routes';

export const metadata: Metadata = {
  title: `About Us | ${appConfig.companyName}`,
  description:
    'Learn about Silver Carz self-drive car rental and read our Terms & Conditions before you book.',
};

type PolicyItem = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
};

/**
 * Official Silver Carz rental policies.
 * Grammar may be polished; amounts, ages, thresholds, and business meaning
 * must match the company's authoritative Terms & Conditions.
 */
const RENTAL_POLICIES: readonly PolicyItem[] = [
  {
    icon: Ban,
    title: 'Cancellation',
    body: 'Customer-initiated cancellations are non-refundable. The booking amount will not be refunded, returned, or transferred/applied toward another booking.',
  },
  {
    icon: Droplets,
    title: 'Cleanliness',
    body: 'The vehicle must be returned in clean condition — washed, with no trash inside. If the vehicle is not cleaned and washed at the end of the booking, a cleaning charge of ₹500 will be charged.',
  },
  {
    icon: Fuel,
    title: 'Fuel',
    body: 'The amount of fuel in the vehicle at handover must be in the vehicle when it is returned. Extra fuel in the vehicle is not refunded.',
  },
  {
    icon: Clock,
    title: 'Timings',
    body: "As per the company's policies, one 24-hour cycle starts from midnight 12 to next day midnight 12.",
  },
  {
    icon: AlarmClock,
    title: 'Extra Timings',
    body: 'If the customer returns the vehicle after the completion of the agreed time, extra charges will be applied accordingly.',
  },
  {
    icon: Receipt,
    title: 'Tolls & Parking',
    body: 'Tolls and parking charges will be paid by the customer. Any other charges from toll (FASTag) must be paid by the customer at the end of the booking.',
  },
  {
    icon: BadgeCheck,
    title: 'Age Eligibility',
    body: 'The customer or the person hiring the vehicle must be 20 years of age or above. A driving licence is compulsory.',
  },
  {
    icon: FileText,
    title: 'Documents',
    body: 'The customer must provide their original Aadhaar card to the company; it will be returned at the end of the booking. The customer must also provide a copy of their driving licence and address proof.',
  },
] as const;

const OTHER_POLICIES: readonly PolicyItem[] = [
  {
    icon: Gauge,
    title: 'Speed Limit',
    body: 'Vehicle speed must not exceed 90 km/hr. If the speed limit is exceeded, a ₹500 charge will be applied on every violation. The vehicle will be tracked.',
  },
  {
    icon: ShieldAlert,
    title: 'Alcohol / Rough Driving',
    body: 'If the vehicle is found to be driven or used in any alcoholic or rough condition, strict action will be taken and a penalty will be charged.',
  },
  {
    icon: CarFront,
    title: 'Interior Damage',
    body: 'If the interior is found to be damaged by cigarette or any other type of damage, extra charges will be applied.',
  },
] as const;

const CLOSING_POLICIES: readonly PolicyItem[] = [
  {
    icon: Wrench,
    title: 'Damage',
    body: 'If there is any damage to the vehicle, it will not be covered under an insurance claim. The customer will have to pay all the repairing charges. Repairs must be done from an authorised car service centre. Rent must be paid for the vehicle while it is in the repairing station.',
  },
  {
    icon: Satellite,
    title: 'GPS Tracking',
    body: 'Our employees will monitor the movement of the vehicle and will keep check on the vehicle.',
  },
  {
    icon: Cigarette,
    title: 'Smoking',
    body: 'Smoking and drinking are not allowed. If any type of ash of cigarette or bottle of liquor is found, a fine will be applicable.',
  },
] as const;

const BOOKING_STEPS = [
  'Select your car and dates on the live availability calendar.',
  'Review and submit your booking request with your details.',
  'Our team reviews and approves the request.',
  'Pay the total when you collect the vehicle.',
] as const;

function PolicyCard({ item, titleAs: Title }: { item: PolicyItem; titleAs: 'h3' | 'h4' }) {
  return (
    <article className="flex h-full min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <item.icon className="size-5" aria-hidden="true" />
      </span>
      <Title className="text-sm font-bold tracking-wide break-words text-foreground uppercase">
        {item.title}
      </Title>
      <p className="text-sm leading-relaxed wrap-break-word text-muted-foreground">{item.body}</p>
    </article>
  );
}

function PolicyGrid({ items, titleAs }: { items: readonly PolicyItem[]; titleAs: 'h3' | 'h4' }) {
  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.title} className="min-w-0">
          <PolicyCard item={item} titleAs={titleAs} />
        </li>
      ))}
    </ul>
  );
}

export default function AboutUsPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-tone-ink text-tone-ink-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(244_180_0_/_0.16),transparent_50%),linear-gradient(to_bottom,#1a1a1a,#0a0a0a)]"
        />
        <CustomerContainer className="relative flex min-h-[12rem] flex-col justify-center py-10 sm:min-h-[14rem] sm:py-14">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Self Drive Car Rental
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight uppercase sm:text-4xl lg:text-5xl">
            About Us
          </h1>
          <p className="mt-2 text-sm text-white/65">
            Home <span className="text-white/35">›</span>{' '}
            <span className="text-primary">About Us</span>
          </p>
        </CustomerContainer>
      </section>

      <section aria-labelledby="about-heading">
        <CustomerContainer className="grid max-w-5xl gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0">
            <h2
              id="about-heading"
              className="text-2xl font-bold tracking-tight uppercase sm:text-3xl"
            >
              About Silver Carz
            </h2>
            <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {appConfig.companyName} is a Nagpur-based self-drive car rental service built around
              one promise: a reliable fleet and a simple, transparent booking experience. Choose a
              car, pick your dates, and hit the road on your own schedule.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Every booking request is reviewed and approved by our team before payment, so you
              always know exactly where your hire stands — from request to confirmation.
            </p>

            <h3 className="mt-8 text-sm font-bold tracking-wide text-foreground uppercase">
              How booking works
            </h3>
            <ol className="mt-4 space-y-3">
              {BOOKING_STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold text-secondary-foreground"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>

            <Link
              href={ROUTES.bookACar}
              className="mt-8 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-bold tracking-wide text-primary-foreground uppercase transition-colors hover:bg-primary/90"
            >
              Book a car
            </Link>
          </div>

          <aside className="rounded-lg border border-border bg-card p-5 shadow-sm lg:sticky lg:top-24">
            <BrandLogo size={48} className="rounded-xl" />
            <p className="mt-4 text-sm font-bold tracking-wide text-foreground uppercase">
              {appConfig.companyName}
            </p>
            <p className="mt-1 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
              Self Drive Car Rental
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Read the full hire terms before you book — they apply to every rental.
            </p>
            <Link
              href="#terms"
              className="mt-4 inline-flex h-10 items-center rounded-md border border-border px-4 text-xs font-bold tracking-wide text-foreground uppercase transition-colors hover:border-primary hover:text-primary"
            >
              View Terms & Conditions
            </Link>
          </aside>
        </CustomerContainer>
      </section>

      <WhyBookBar title="Why Choose Silver Carz" />

      <section
        id="terms"
        aria-labelledby="terms-heading"
        className="scroll-mt-24 border-y border-border bg-muted/40"
      >
        <CustomerContainer className="max-w-5xl py-12 sm:py-16">
          <h2
            id="terms-heading"
            className="text-2xl font-bold tracking-tight uppercase sm:text-3xl"
          >
            Terms & Conditions
          </h2>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">
            Please read the following terms and conditions carefully before booking a vehicle with{' '}
            {appConfig.companyName}.
          </p>

          <PolicyGrid items={RENTAL_POLICIES} titleAs="h3" />

          <h3 className="mt-12 text-lg font-bold tracking-wide text-foreground uppercase">
            Other Terms
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The following conditions apply throughout the hire period.
          </p>
          <PolicyGrid items={OTHER_POLICIES} titleAs="h4" />

          <div className="mt-4 border-t border-border pt-4">
            <PolicyGrid items={CLOSING_POLICIES} titleAs="h3" />
          </div>
        </CustomerContainer>
      </section>
    </>
  );
}
