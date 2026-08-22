'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';

import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { carDetailingSite } from '@/config/car-detailing';

const SECTION_LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#prices', label: 'Prices' },
  { href: '#location', label: 'Location' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#about', label: 'About Us' },
  { href: '#contact', label: 'Contact' },
] as const;

export function DetailingSectionNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      aria-label="Car detailing sections"
      className={`sticky top-16 z-30 border-b transition-colors duration-300 sm:top-[4.25rem] ${
        scrolled
          ? 'border-border bg-background/95 backdrop-blur-md'
          : 'border-border/60 bg-background'
      }`}
    >
      <CustomerContainer className="flex h-12 items-center justify-between gap-4 sm:h-14">
        <div className="flex min-w-0 flex-1 scrollbar-none items-center gap-4 overflow-x-auto sm:gap-6 lg:gap-8">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              data-cursor
              data-cursor-label={link.label}
              data-cursor-size="72"
              className="shrink-0 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-primary sm:text-xs"
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href={carDetailingSite.phoneHref}
          data-cursor
          data-cursor-label="Call"
          data-cursor-size="64"
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-3 py-2 text-[10px] font-semibold tracking-wide text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4 sm:text-xs"
        >
          <Phone className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{carDetailingSite.phone}</span>
          <span className="sm:hidden">Call</span>
        </a>
      </CustomerContainer>
    </motion.nav>
  );
}
