import { ROUTES } from '@/constants/routes';

export interface CustomerNavItem {
  readonly title: string;
  readonly href: string;
}

/**
 * Primary customer header / mobile navigation.
 * Exactly three primary website pages — nothing else.
 */
export const customerMainNavItems: readonly CustomerNavItem[] = [
  { title: 'Book a Car', href: ROUTES.bookACar },
  { title: 'Car Detailing', href: ROUTES.carDetailing },
  { title: 'About Us', href: ROUTES.aboutUs },
] as const;

/** Footer quick links — same primary pages. */
export const customerQuickLinkItems: readonly CustomerNavItem[] = customerMainNavItems;

/** Legal links for the customer footer bar. */
export const customerLegalNavItems: readonly CustomerNavItem[] = [
  { title: 'Terms & Conditions', href: `${ROUTES.aboutUs}#terms` },
] as const;
