/**
 * Browser storage / cookie keys used across the application.
 *
 * Keep every localStorage / sessionStorage / cookie key here so keys stay
 * unique and easy to rotate.
 */
export const STORAGE_KEYS = {
  theme: 'silvercarz-theme',
  /** Cookie written by SidebarProvider — read on SSR to avoid width CLS. */
  sidebarState: 'sidebar_state',
  /** Customer booking city chosen from the India city selector. */
  bookingCity: 'silvercarz-booking-city',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Sidebar open-state cookie lifetime (matches SidebarProvider). */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Booking city cookie lifetime (30 days). */
export const BOOKING_CITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
