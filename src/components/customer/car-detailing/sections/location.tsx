'use client';

import { motion } from 'framer-motion';
import { Clock, MapPin, Phone } from 'lucide-react';

import { DetailingButton } from '@/components/customer/car-detailing/detailing-button';
import { DetailingSectionWrapper } from '@/components/customer/car-detailing/detailing-section-wrapper';
import { detailingFadeUp } from '@/components/customer/car-detailing/lib/animations';
import {
  carDetailingMapsEmbedUrl,
  carDetailingMapsLink,
  carDetailingSite,
} from '@/config/car-detailing';

const DETAILS = [
  {
    icon: MapPin,
    label: 'Address',
    value: `${carDetailingSite.address.street}, ${carDetailingSite.address.city}, ${carDetailingSite.address.state} ${carDetailingSite.address.postalCode}`,
  },
  {
    icon: Phone,
    label: 'Phone',
    value: carDetailingSite.phone,
    href: carDetailingSite.phoneHref,
  },
  {
    icon: Clock,
    label: 'Hours',
    value: `${carDetailingSite.hours.label} IST`,
  },
] as const;

export function DetailingLocation() {
  return (
    <DetailingSectionWrapper
      id="location"
      index="04"
      eyebrow="Location"
      title="Find us in Nagpur."
      description="We're at Mangalmurti Square in Rajendra Nagar — easy to reach from Takli Seem, Manish Nagar, Khamla, and Wardha Road."
    >
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <motion.div
          variants={detailingFadeUp}
          className="detailing-card min-h-[320px] overflow-hidden md:min-h-[440px]"
        >
          <iframe
            src={carDetailingMapsEmbedUrl}
            title="Silver Carz studio location on Google Maps — Mangalmurti Square, Rajendra Nagar, Nagpur"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full min-h-[320px] w-full border-0 md:min-h-[440px]"
          />
        </motion.div>

        <motion.div variants={detailingFadeUp} className="detailing-card flex flex-col p-6 md:p-8">
          <dl className="space-y-6">
            {DETAILS.map((item) => (
              <div key={item.label} className="flex gap-4">
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <dt className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed">
                    {'href' in item && item.href ? (
                      <a href={item.href} className="transition-colors hover:text-primary">
                        {item.value}
                      </a>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6">
            <DetailingButton
              href={carDetailingMapsLink}
              external
              variant="pill"
              cursorLabel="Maps"
              className="w-full"
            >
              Get directions
            </DetailingButton>
            <DetailingButton href="#contact" variant="ghost" cursorLabel="Book" className="w-full">
              Book a slot
            </DetailingButton>
          </div>
        </motion.div>
      </div>
    </DetailingSectionWrapper>
  );
}
