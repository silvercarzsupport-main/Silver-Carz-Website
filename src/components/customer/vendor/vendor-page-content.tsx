import { Building2, Handshake, Mail, Phone, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';

import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { vendorConfig } from '@/config/vendor';

const PARTNERSHIP_STEPS = [
  {
    step: '01',
    title: 'Reach out',
    description:
      'Email or call our partnerships team with your fleet size, operating city, and vehicle types.',
  },
  {
    step: '02',
    title: 'Fleet review',
    description: 'We review documentation, vehicle condition, and compliance before onboarding.',
  },
  {
    step: '03',
    title: 'Onboarding',
    description:
      'Approved partners are listed on Silver Carz with agreed commercial terms and support.',
  },
] as const;

const PARTNER_BENEFITS = [
  {
    icon: Truck,
    title: 'Fleet visibility',
    description: 'Reach customers booking self-drive cars in your city through Silver Carz.',
  },
  {
    icon: ShieldCheck,
    title: 'Trusted brand',
    description: 'Operate under a professional rental experience with clear booking workflows.',
  },
  {
    icon: Handshake,
    title: 'Dedicated support',
    description: 'Work with our team on listings, availability, and partner coordination.',
  },
  {
    icon: Building2,
    title: 'Structured onboarding',
    description: 'Simple steps to register vehicles and keep your fleet information up to date.',
  },
] as const;

export function VendorPageContent() {
  return (
    <>
      <section className="relative overflow-hidden bg-tone-ink text-tone-ink-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(244_180_0_/_0.16),transparent_50%),linear-gradient(to_bottom,#1a1a1a,#0a0a0a)]"
        />
        <CustomerContainer className="relative flex min-h-[12rem] flex-col justify-center py-10 sm:min-h-[14rem] sm:py-14">
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Partner with {vendorConfig.companyName}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight uppercase sm:text-4xl lg:text-5xl">
            Become a Vendor
          </h1>
          <p className="mt-2 text-sm text-white/65">
            Home <span className="text-white/35">›</span>{' '}
            <span className="text-primary">Vendor</span>
          </p>
        </CustomerContainer>
      </section>

      <CustomerContainer className="py-10 sm:py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-12">
          <div className="min-w-0 space-y-10">
            <section className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight uppercase sm:text-2xl">
                List your fleet with Silver Carz
              </h2>
              <div className="h-1 w-12 bg-primary" aria-hidden="true" />
              <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
                Silver Carz partners with independent fleet owners and operators who maintain
                quality self-drive vehicles. If you run cars in India and want them listed for
                customer bookings, our vendor programme is the place to start.
              </p>
            </section>

            <section className="space-y-5">
              <h2 className="text-lg font-bold tracking-tight uppercase">Why partner with us</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {PARTNER_BENEFITS.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-lg border border-border bg-card p-4 shadow-sm"
                  >
                    <item.icon className="size-5 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-bold tracking-wide uppercase">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-5">
              <h2 className="text-lg font-bold tracking-tight uppercase">How to apply</h2>
              <ol className="space-y-4">
                {PARTNERSHIP_STEPS.map((item) => (
                  <li
                    key={item.step}
                    className="flex gap-4 rounded-lg border border-border bg-card p-4"
                  >
                    <span className="text-lg font-bold text-primary tabular-nums">{item.step}</span>
                    <div>
                      <h3 className="text-sm font-bold tracking-wide uppercase">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-5">
              <h2 className="text-sm font-bold tracking-wide uppercase">What to include</h2>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                <li>Your name and business / fleet operator details</li>
                <li>City or cities where your vehicles are stationed</li>
                <li>Number of vehicles and typical models (sedan, SUV, hatchback, etc.)</li>
                <li>Registration and insurance status of the fleet</li>
                <li>Preferred contact number and email for follow-up</li>
              </ul>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold tracking-tight uppercase">Contact partnerships</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ready to join as a vendor? Reach our team directly using the details below.
              </p>

              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Email
                    </p>
                    <a
                      href={`mailto:${vendorConfig.email}?subject=${encodeURIComponent('Silver Carz vendor partnership enquiry')}`}
                      className="mt-1 block text-sm font-medium break-all text-foreground hover:text-primary"
                    >
                      {vendorConfig.email}
                    </a>
                  </div>
                </div>

                {vendorConfig.phone && vendorConfig.phoneDisplay ? (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Phone
                      </p>
                      <a
                        href={`tel:${vendorConfig.phone.replace(/\s/g, '')}`}
                        className="mt-1 block text-sm font-medium text-foreground hover:text-primary"
                      >
                        {vendorConfig.phoneDisplay}
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>

              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                {vendorConfig.businessHours}
                <br />
                {vendorConfig.responseTime}
              </p>

              <Button asChild className="mt-6 w-full rounded-md font-semibold">
                <Link
                  href={`mailto:${vendorConfig.email}?subject=${encodeURIComponent('Silver Carz vendor partnership enquiry')}`}
                >
                  Email partnerships team
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </CustomerContainer>
    </>
  );
}
