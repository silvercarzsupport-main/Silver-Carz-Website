'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

type Variant = 'pill' | 'ghost' | 'circle';

type DetailingButtonProps = {
  children: ReactNode;
  variant?: Variant;
  href?: string;
  external?: boolean;
  cursorLabel?: string;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
};

export function DetailingButton({
  children,
  variant = 'pill',
  href,
  external = false,
  cursorLabel = 'Go',
  className = '',
  type = 'button',
  onClick,
}: DetailingButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  const styles: Record<Variant, string> = {
    pill: `${base} rounded-full bg-primary px-6 py-3 text-sm font-semibold tracking-wide text-primary-foreground hover:bg-primary/90`,
    ghost: `${base} rounded-full border border-border bg-transparent px-6 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground`,
    circle: `${base} relative group`,
  };

  const content =
    variant === 'circle' ? (
      <>
        <span className="relative z-10 pr-14 text-sm font-semibold tracking-[0.14em] text-tone-ink-foreground uppercase">
          {children}
        </span>
        <span className="absolute top-1/2 right-0 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 text-white/80 transition-colors group-hover:border-primary group-hover:text-primary">
          <ArrowRight className="h-4 w-4" />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 h-20 w-20 -translate-y-1/2 rounded-full bg-primary/30 opacity-70 blur-2xl transition-opacity group-hover:opacity-100"
        />
      </>
    ) : (
      children
    );

  const cls = `${styles[variant]} ${className}`;
  const cursorProps = {
    'data-cursor': 'true',
    'data-cursor-label': cursorLabel,
    'data-cursor-size': '64',
  };

  if (href) {
    return (
      <motion.a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cls}
        {...cursorProps}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cls}
      {...cursorProps}
    >
      {content}
    </motion.button>
  );
}
