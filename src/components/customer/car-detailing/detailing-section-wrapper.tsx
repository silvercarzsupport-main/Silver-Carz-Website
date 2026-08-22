'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { CustomerContainer } from '@/components/customer/shared/customer-container';
import {
  detailingFadeUp,
  detailingStaggerContainer,
} from '@/components/customer/car-detailing/lib/animations';
import { cn } from '@/lib/utils';

type DetailingSectionWrapperProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  index?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function DetailingSectionWrapper({
  id,
  children,
  className = '',
  index,
  eyebrow,
  title,
  description,
}: DetailingSectionWrapperProps) {
  return (
    <section id={id} className={cn('py-16 md:py-24', className)}>
      <CustomerContainer>
        <motion.div
          variants={detailingStaggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {(index || eyebrow || title || description) && (
            <div className="mb-10 max-w-2xl md:mb-14">
              {(index || eyebrow) && (
                <motion.p
                  variants={detailingFadeUp}
                  className="mb-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase"
                >
                  {index && (
                    <span className="mr-2 font-semibold tracking-[0.08em] text-primary">
                      [{index}]
                    </span>
                  )}
                  {eyebrow}
                </motion.p>
              )}
              {title && (
                <motion.h2
                  variants={detailingFadeUp}
                  className="text-2xl font-bold tracking-tight uppercase sm:text-3xl lg:text-4xl"
                >
                  {title}
                </motion.h2>
              )}
              {description && (
                <motion.p
                  variants={detailingFadeUp}
                  className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg"
                >
                  {description}
                </motion.p>
              )}
            </div>
          )}
          {children}
        </motion.div>
      </CustomerContainer>
    </section>
  );
}
