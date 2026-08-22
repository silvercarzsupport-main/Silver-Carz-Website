'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { DetailingButton } from '@/components/customer/car-detailing/detailing-button';
import { DetailingSectionWrapper } from '@/components/customer/car-detailing/detailing-section-wrapper';
import { detailingFadeUp } from '@/components/customer/car-detailing/lib/animations';
import { carDetailingFaqs, carDetailingSite } from '@/config/car-detailing';

export function DetailingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <DetailingSectionWrapper
      id="faq"
      index="07"
      eyebrow="FAQ"
      title="Questions, answered."
      description="Everything Nagpur car owners usually ask before booking."
      className="bg-muted/50"
    >
      <div className="mx-auto max-w-3xl space-y-3">
        {carDetailingFaqs.map((faq, i) => {
          const isOpen = open === i;
          return (
            <motion.div
              key={faq.q}
              variants={detailingFadeUp}
              className="detailing-card overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                data-cursor
                data-cursor-label={isOpen ? 'Close' : 'Open'}
                data-cursor-size="48"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left md:px-7 md:py-5"
              >
                <h3 className="text-sm font-semibold md:text-base">{faq.q}</h3>
                <Plus
                  className={`h-4 w-4 shrink-0 text-primary transition-transform duration-300 ${
                    isOpen ? 'rotate-45' : ''
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground md:px-7 md:pb-6">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        variants={detailingFadeUp}
        className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-4 text-center"
      >
        <p className="text-sm text-muted-foreground">
          Still have a question? We reply fastest on WhatsApp.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <DetailingButton href="#contact" variant="pill" cursorLabel="Book">
            Book a slot
          </DetailingButton>
          <DetailingButton href={carDetailingSite.phoneHref} variant="ghost" cursorLabel="Call">
            Call {carDetailingSite.phone}
          </DetailingButton>
        </div>
      </motion.div>
    </DetailingSectionWrapper>
  );
}
