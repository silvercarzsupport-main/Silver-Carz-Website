'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

import { DetailingButton } from '@/components/customer/car-detailing/detailing-button';
import { DetailingSectionWrapper } from '@/components/customer/car-detailing/detailing-section-wrapper';
import { detailingFadeUp } from '@/components/customer/car-detailing/lib/animations';
import {
  carDetailingAlsoDone,
  carDetailingCategories,
  carDetailingRateCard,
} from '@/config/car-detailing';

export function DetailingPricing() {
  const [vehicle, setVehicle] = useState(0);

  return (
    <DetailingSectionWrapper
      id="prices"
      index="03"
      eyebrow="Rate card"
      title="Car wash & detailing prices in Nagpur."
      description="Pick your vehicle type — see exact rates instantly. All prices in INR, no hidden charges."
      className="bg-muted/50"
    >
      <motion.div variants={detailingFadeUp} className="detailing-card p-4 sm:p-5 md:hidden">
        <p className="mb-3 text-xs tracking-[0.14em] text-muted-foreground uppercase">
          Select your vehicle
        </p>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1">
          {carDetailingCategories.map((cat, i) => (
            <button
              key={cat}
              type="button"
              onClick={() => setVehicle(i)}
              className={`rounded-xl px-2 py-2.5 text-[11px] font-semibold tracking-wide uppercase transition-colors ${
                vehicle === i
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.ul
            key={vehicle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-2"
          >
            {carDetailingRateCard.map((row, i) => (
              <li key={row.service}>
                <a
                  href="#contact"
                  className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3.5 active:border-primary/30"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] text-primary/80">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="mt-0.5 text-sm leading-snug">{row.service}</p>
                  </div>
                  <p className="shrink-0 text-base font-semibold">{row.prices[vehicle]}</p>
                </a>
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>

        <div className="mt-5">
          <DetailingButton href="#contact" variant="pill" className="w-full" cursorLabel="Book">
            Book for {carDetailingCategories[vehicle]}
          </DetailingButton>
        </div>
      </motion.div>

      <motion.div
        variants={detailingFadeUp}
        className="detailing-card hidden overflow-hidden md:block"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-primary text-primary-foreground">
              <th className="px-5 py-4 text-left text-xs font-semibold tracking-[0.14em] uppercase">
                Service
              </th>
              {carDetailingCategories.map((cat) => (
                <th
                  key={cat}
                  className="px-4 py-4 text-center text-xs font-semibold tracking-[0.12em] uppercase"
                >
                  {cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carDetailingRateCard.map((row, i) => (
              <tr
                key={row.service}
                className={`border-b border-border ${i % 2 === 0 ? 'bg-muted/30' : ''}`}
              >
                <td className="px-5 py-4 pr-8 leading-snug text-muted-foreground">
                  <span className="mr-2 text-[10px] text-primary/80">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {row.service}
                </td>
                {row.prices.map((price) => (
                  <td key={price} className="px-4 py-4 text-center font-semibold whitespace-nowrap">
                    {price}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <motion.div
        variants={detailingFadeUp}
        className="detailing-card mt-5 px-5 py-6 md:px-8 md:py-8"
      >
        <span className="inline-block rounded-full bg-primary px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-primary-foreground uppercase">
          Also done here
        </span>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 md:divide-x md:divide-border">
          {carDetailingAlsoDone.map((item) => (
            <p
              key={item}
              className="rounded-xl border border-border py-3 text-center text-sm font-semibold sm:border-0 sm:py-0 md:px-4 first:md:pl-0 last:md:pr-0"
            >
              {item}
            </p>
          ))}
        </div>
      </motion.div>

      <motion.div variants={detailingFadeUp} className="mt-8 hidden justify-center md:flex">
        <DetailingButton href="#contact" variant="pill" cursorLabel="Book">
          Book a service
        </DetailingButton>
      </motion.div>
    </DetailingSectionWrapper>
  );
}
