'use client';

import { motion } from 'framer-motion';

import { DetailingSectionWrapper } from '@/components/customer/car-detailing/detailing-section-wrapper';
import { detailingFadeUp } from '@/components/customer/car-detailing/lib/animations';

const ABOUT_DETAILS = [
  ['Location', 'Mangalmurti Square, Rajendra Nagar, Takli Seem, Nagpur, Maharashtra 440036'],
  ['Contact', '+91 90284 68412'],
  ['Focus', 'Premium detailing & coatings'],
  ['Promise', 'Showroom-grade finish'],
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
            {ABOUT_DETAILS.map(([key, value]) => (
              <div
                key={key}
                className="flex items-start justify-between gap-6 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <dt className="text-xs tracking-[0.18em] text-primary uppercase">{key}</dt>
                <dd className="text-right text-sm text-muted-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </div>
    </DetailingSectionWrapper>
  );
}
