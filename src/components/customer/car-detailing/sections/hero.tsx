'use client';

import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

import { DetailingButton } from '@/components/customer/car-detailing/detailing-button';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import {
  detailingFadeUp,
  detailingStaggerContainer,
} from '@/components/customer/car-detailing/lib/animations';

const STATS = [
  { value: '6+', label: 'Years experience' },
  { value: '1,200+', label: 'Cars detailed' },
  { value: '97%', label: 'Repeat clients' },
  { value: 'Same day', label: 'Express slots' },
] as const;

export function DetailingHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-[85vh] flex-col overflow-hidden bg-tone-ink text-tone-ink-foreground lg:min-h-screen"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(244_180_0_/_0.16),transparent_50%),linear-gradient(to_bottom,#1a1a1a,#0a0a0a)]"
      />

      <CustomerContainer className="relative z-10 flex flex-1 flex-col gap-10 py-10 lg:flex-row lg:items-center lg:gap-8 lg:py-14">
        <motion.div
          variants={detailingStaggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-xl flex-1"
        >
          <motion.p
            variants={detailingFadeUp}
            className="mb-4 text-xs font-semibold tracking-[0.2em] text-primary uppercase"
          >
            <span className="mr-2 tracking-[0.08em]">[01]</span>
            Silver Carz · Rajendra Nagar, Nagpur
          </motion.p>
          <motion.h1
            variants={detailingFadeUp}
            className="text-3xl leading-[1.08] font-bold tracking-tight uppercase sm:text-4xl lg:text-5xl"
          >
            Premium car detailing{' '}
            <span className="block text-white/85">&amp; car wash in Nagpur.</span>
          </motion.h1>
          <motion.p
            variants={detailingFadeUp}
            className="mt-6 max-w-md text-base leading-relaxed text-white/65 md:text-lg"
          >
            Studio-grade car wash from ₹200, interior deep cleaning, ceramic coating, and paint
            correction — a showroom finish for drivers across Nagpur, every time.
          </motion.p>
          <motion.div
            variants={detailingFadeUp}
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5"
          >
            <DetailingButton variant="circle" href="#contact" cursorLabel="Book">
              Book a detail
            </DetailingButton>
            <DetailingButton
              variant="ghost"
              href="#prices"
              cursorLabel="Rates"
              className="border-white/20 text-white/70 hover:border-primary hover:text-primary"
            >
              View rate card
            </DetailingButton>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ y: imageY, scale: imageScale }}
          className="detailing-card relative min-h-[280px] flex-1 overflow-hidden sm:min-h-[320px] lg:min-h-[520px]"
        >
          <div className="pointer-events-none absolute inset-0 z-10 hidden bg-gradient-to-r from-tone-ink via-tone-ink/40 to-transparent lg:block" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-tone-ink to-transparent lg:hidden" />
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-tone-ink via-transparent to-transparent" />
          <Image
            src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80"
            alt="Premium car detailing in Nagpur — polished luxury black car at Silver Carz studio"
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 55vw"
          />
        </motion.div>
      </CustomerContainer>

      <div className="relative z-20 pb-6">
        <CustomerContainer>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="detailing-card border-white/10 bg-white/[0.04] px-5 py-6 shadow-none md:px-10 md:py-7"
          >
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-0 md:divide-x md:divide-border">
              {STATS.map((stat) => (
                <div key={stat.label} className="md:px-6 first:md:pl-0 last:md:pr-0">
                  <p className="text-2xl font-bold md:text-3xl">{stat.value}</p>
                  <p className="mt-1 text-xs tracking-wide text-white/55 uppercase">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </CustomerContainer>
      </div>
    </section>
  );
}
