'use client';

import { motion } from 'framer-motion';
import { Droplets, Shield, Sparkles, Wind } from 'lucide-react';

import { DetailingButton } from '@/components/customer/car-detailing/detailing-button';
import { DetailingSectionWrapper } from '@/components/customer/car-detailing/detailing-section-wrapper';
import { detailingFadeUp } from '@/components/customer/car-detailing/lib/animations';

const SERVICES = [
  {
    icon: Sparkles,
    title: 'Exterior detailing',
    text: 'Paint decontamination, polish, and mirror-finish gloss restoration.',
  },
  {
    icon: Wind,
    title: 'Interior revitalize',
    text: 'Deep clean, leather care, and odor extraction for a reset cabin.',
  },
  {
    icon: Shield,
    title: 'Ceramic coating',
    text: 'Long-term hydrophobic protection with a deep, wet-look shine.',
  },
  {
    icon: Droplets,
    title: 'Paint correction',
    text: 'Swirl and haze removal tuned for dark and silver finishes.',
  },
] as const;

export function DetailingServices() {
  return (
    <DetailingSectionWrapper
      id="services"
      index="02"
      eyebrow="Services"
      title="Car detailing services in Nagpur."
      description="A focused menu of packages built around finish quality — not rushed add-ons. Washing, detailing, coating, denting and painting, all under one roof."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((service) => (
          <motion.article
            key={service.title}
            variants={detailingFadeUp}
            data-cursor
            data-cursor-label="View"
            data-cursor-size="56"
            whileHover={{ y: -4 }}
            className="group detailing-card p-6 transition-colors hover:border-primary/30 md:p-7"
          >
            <service.icon className="mb-5 h-5 w-5 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">{service.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{service.text}</p>
            <span className="mt-5 block h-px w-0 bg-primary transition-all duration-300 group-hover:w-12" />
          </motion.article>
        ))}
      </div>

      <motion.div
        variants={detailingFadeUp}
        className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
      >
        <DetailingButton href="#prices" variant="pill" cursorLabel="Rates">
          See full rate card
        </DetailingButton>
        <DetailingButton href="#contact" variant="ghost" cursorLabel="Book">
          Book a service
        </DetailingButton>
      </motion.div>
    </DetailingSectionWrapper>
  );
}
