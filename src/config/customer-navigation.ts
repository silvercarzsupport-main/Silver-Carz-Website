import { ROUTES } from '@/constants/routes';

export interface CustomerNavItem {
  readonly title: string;
  readonly href: string;
}

/**
 * Primary customer header / mobile navigation.
 * Exactly four primary website pages — nothing else.
 */
export const customerMainNavItems: readonly CustomerNavItem[] = [
  { title: 'Book a Car', href: ROUTES.bookACar },
  { title: 'Car Detailing', href: ROUTES.carDetailing },
  { title: 'Vendor', href: ROUTES.vendor },
  { title: 'About Us', href: ROUTES.aboutUs },
] as const;

/** Footer quick links — same four primary pages. */
export const customerQuickLinkItems: readonly CustomerNavItem[] = customerMainNavItems;

/** Legal links for the customer footer bar. */
export const customerLegalNavItems: readonly CustomerNavItem[] = [
  { title: 'Terms & Conditions', href: `${ROUTES.aboutUs}#terms` },
] as const;
