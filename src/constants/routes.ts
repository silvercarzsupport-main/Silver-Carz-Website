/**
 * Canonical application route paths.
 *
 * Feature modules and navigation must import from here — never hardcode
 * path strings. Add new routes as modules are introduced.
 *
 * Admin portal lives under `/admin`. The public customer site uses `/`.
 *
 * Primary customer pages (nav):
 *   /                 Book a Car
 *   /car-detailing    Car Detailing
 *   /about-us         About Us
 */

export const ROUTES = {
  // --- Customer portal (primary pages) ---
  home: '/',
  bookACar: '/',
  carDetailing: '/car-detailing',
  aboutUs: '/about-us',

  // --- Customer account / workflow (not primary nav) ---
  customerLogin: '/login',
  customerSignup: '/signup',
  myBookings: '/my-bookings',
  profile: '/profile',
  /** Authenticated booking request wizard after vehicle selection. */
  bookingContinue: '/booking/continue',

  // --- Admin portal ---
  admin: '/admin',
  login: '/admin/login',
  forgotPassword: '/admin/forgot-password',
  resetPassword: '/admin/reset-password',
  authCallback: '/auth/callback',
  dashboard: '/admin/dashboard',
  bookings: '/admin/bookings',
  /** Confirmed fleet bookings queue (excludes pending draft requests). */
  bookingsConfirmed: '/admin/bookings?view=confirmed',
  bookingsNew: '/admin/bookings/new',
  vehicles: '/admin/vehicles',
  vehiclesNew: '/admin/vehicles/new',
  calendar: '/admin/calendar',
  customers: '/admin/customers',
  drivers: '/admin/drivers',
  settings: '/admin/settings',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/** Dynamic detail path for a booking id (admin). */
export function bookingDetailPath(id: string): string {
  return `${ROUTES.bookings}/${id}`;
}

/** Dynamic edit path for a booking id (admin). */
export function bookingEditPath(id: string): string {
  return `${ROUTES.bookings}/${id}/edit`;
}

/** Dynamic detail path for a vehicle id (admin). */
export function vehicleDetailPath(id: string): string {
  return `${ROUTES.vehicles}/${id}`;
}

/** Dynamic edit path for a vehicle id (admin). */
export function vehicleEditPath(id: string): string {
  return `${ROUTES.vehicles}/${id}/edit`;
}

/**
 * Authenticated booking wizard path that preserves the selected vehicle.
 * When both booking dates are provided, defaults to the details step.
 */
export function customerBookingContinuePath(
  vehicleId: string,
  step?: 'dates' | 'details' | 'review',
  dates?: { readonly deliveryDate?: string | null; readonly returnDate?: string | null },
): string {
  const params = new URLSearchParams({ vehicle: vehicleId });
  const deliveryDate = dates?.deliveryDate?.trim() || '';
  const returnDate = dates?.returnDate?.trim() || '';
  const hasDates = Boolean(deliveryDate && returnDate);

  if (hasDates) {
    params.set('from', deliveryDate);
    params.set('to', returnDate);
  }

  const resolvedStep = step ?? (hasDates ? 'details' : 'dates');
  if (resolvedStep !== 'dates') {
    params.set('step', resolvedStep);
  }

  return `${ROUTES.bookingContinue}?${params.toString()}`;
}

/** Customer booking request detail / pending-approval path. */
export function customerBookingPath(bookingId: string): string {
  return `/booking/${bookingId}`;
}

/** Customer booking documents step. */
export function customerBookingDocumentsPath(bookingId: string): string {
  return `/booking/${bookingId}/documents`;
}
