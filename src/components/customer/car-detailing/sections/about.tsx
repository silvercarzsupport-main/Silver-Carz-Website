'use client';

import { motion } from 'framer-motion';

import { DetailingSectionWrapper } from '@/components/customer/car-detailing/detailing-section-wrapper';
import { detailingFadeUp } from '@/components/customer/car-detailing/lib/animations';
import { carDetailingSite } from '@/config/car-detailing';

const ABOUT_DETAILS = [
  {
    key: 'Location',
    value: 'Mangalmurti Square, Rajendra Nagar, Takli Seem, Nagpur, Maharashtra 440036',
  },
  { key: 'Phone', value: carDetailingSite.phone, href: carDetailingSite.phoneHref },
  { key: 'Email', value: carDetailingSite.email, href: carDetailingSite.emailHref },
  {
    key: 'Instagram',
    value: carDetailingSite.instagramHandle,
    href: carDetailingSite.instagramUrl,
    external: true,
  },
  { key: 'Focus', value: 'Premium detailing & coatings' },
  { key: 'Promise', value: 'Showroom-grade finish' },
] as const;

export function DetailingAbout() {
  return (
    <DetailingSectionWrapper
      id="about"
      index="06"
      eyebrow="About us"
      title="Nagpur's silver standard in car care."
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <motion.p
          variants={detailingFadeUp}
          className="text-lg leading-relaxed text-muted-foreground md:text-xl"
        >
          Silver Carz is a Nagpur-based car detailing and car wash studio built around precision,
          patience, and materials that last. From hatchbacks to luxury SUVs, every vehicle is
          treated like a showpiece — from the first rinse to the final inspection under studio
          lighting. Find us at Mangalmurti Square in Rajendra Nagar, serving car owners across Takli
          Seem, Manish Nagar, Khamla, Trimurti Nagar, and the Wardha Road side of Nagpur.
        </motion.p>
        <motion.div variants={detailingFadeUp} className="detailing-card p-8 md:p-10">
          <dl className="space-y-5">
            {ABOUT_DETAILS.map((item) => (
              <div
                key={item.key}
                className="flex items-start justify-between gap-6 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <dt className="text-xs tracking-[0.18em] text-primary uppercase">{item.key}</dt>
                <dd className="text-right text-sm text-muted-foreground">
                  {'href' in item && item.href ? (
                    <a
                      href={item.href}
                      className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                      {...('external' in item && item.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {item.value}
                    </a>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>
    </DetailingSectionWrapper>
  );
}
