'use client';

import type { ReactNode } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { portalConfig } from '@/config';
import { THEME } from '@/constants';
import { ThemeProvider } from '@/providers/theme-provider';

/**
 * Root client provider composition.
 *
 * Default portal comes from `portalConfig` (admin SSR fallback).
 * Route groups override via `PortalThemeScope` (customer vs admin).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      portal={portalConfig.theme}
      attribute="class"
      defaultTheme={THEME.defaultTheme}
      enableSystem
      disableTransitionOnChange
      storageKey={THEME.storageKey}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
