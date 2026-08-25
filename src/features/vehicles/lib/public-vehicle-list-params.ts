/**
 * Customer Book a Car URL state ↔ VehicleListQuery mapping.
 *
 * Booking city is cookie-backed (location prompt), not a public URL param.
 * Optional `from` / `to` dates filter the fleet to cars free in that window.
 */

import {
  getBookingHorizonEndIso,
  todayIsoIst,
} from '@/features/customer-booking/lib/calendar-dates';
import type { VehicleListQuery } from '@/types/vehicle';
import { isVehicleAvailabilityStatus } from '@/types/enums';

export type CustomerAvailabilityFilter = 'all' | 'available';

export interface CustomerBookACarUrlState {
  readonly availability: CustomerAvailabilityFilter;
  /** Pickup date `YYYY-MM-DD`, or null when unset / invalid. */
  readonly deliveryDate: string | null;
  /** Return date `YYYY-MM-DD`, or null when unset / invalid. */
  readonly returnDate: string | null;
  readonly vehicleId: string | null;
  readonly page: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateString(value: string | null | undefined): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

/**
 * Validates a browse/wizard date window against the customer booking horizon.
 * Returns null when both dates are valid; otherwise a short user-facing message.
 */
export function validateBrowseDateRange(
  deliveryDate: string | null | undefined,
  returnDate: string | null | undefined,
  asOfIso: string = todayIsoIst(),
): string | null {
  if (!deliveryDate && !returnDate) {
    return null;
  }
  if (!isIsoDateString(deliveryDate) || !isIsoDateString(returnDate)) {
    return 'Select both a pickup date and a return date.';
  }
  if (returnDate < deliveryDate) {
    return 'Return date must be on or after pickup.';
  }
  const today = asOfIso;
  const horizon = getBookingHorizonEndIso(today);
  if (deliveryDate < today) {
    return 'Pickup date cannot be in the past.';
  }
  if (deliveryDate > horizon || returnDate > horizon) {
    return 'Pickup and return must fall within this month or next month.';
  }
  return null;
}

export function hasValidBrowseDates(state: CustomerBookACarUrlState): boolean {
  return (
    validateBrowseDateRange(state.deliveryDate, state.returnDate) === null &&
    isIsoDateString(state.deliveryDate) &&
    isIsoDateString(state.returnDate)
  );
}

function parseIsoDateParam(value: string | undefined): string | null {
  if (!value || !ISO_DATE_RE.test(value)) {
    return null;
  }
  return value;
}

function parseAvailability(value: string | undefined): CustomerAvailabilityFilter {
  if (value === 'available') {
    return 'available';
  }
  // Accept legacy exact status for forward-compat.
  if (value && isVehicleAvailabilityStatus(value) && value === 'available') {
    return 'available';
  }
  return 'all';
}

export function parseCustomerBookACarUrlState(
  searchParams: Record<string, string | string[] | undefined>,
): CustomerBookACarUrlState {
  const availabilityRaw = firstParam(searchParams.availability);
  const fromRaw = firstParam(searchParams.from);
  const toRaw = firstParam(searchParams.to);
  const vehicleRaw = firstParam(searchParams.vehicle);
  const pageRaw = firstParam(searchParams.page);
  const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);

  const deliveryDate = parseIsoDateParam(fromRaw);
  const returnDate = parseIsoDateParam(toRaw);

  // Drop incomplete / invalid pairs so list filtering stays consistent.
  const rangeError = validateBrowseDateRange(deliveryDate, returnDate);
  const datesValid = rangeError === null && deliveryDate && returnDate;

  return {
    availability: parseAvailability(availabilityRaw),
    deliveryDate: datesValid ? deliveryDate : null,
    returnDate: datesValid ? returnDate : null,
    vehicleId: vehicleRaw?.trim() || null,
    page,
  };
}

export function toPublicVehicleListQuery(
  state: CustomerBookACarUrlState,
  city: string,
  options?: { readonly excludeIds?: readonly string[] },
): VehicleListQuery {
  return {
    isActive: true,
    available: state.availability === 'available' ? true : undefined,
    city,
    excludeIds: options?.excludeIds?.length ? options.excludeIds : undefined,
    page: state.page,
    pageSize: 12,
    sortBy: 'vehicle_name',
    sortOrder: 'asc',
  };
}

export function buildCustomerBookACarSearchParams(
  state: CustomerBookACarUrlState,
  updates: Partial<CustomerBookACarUrlState> = {},
): string {
  const next: CustomerBookACarUrlState = { ...state, ...updates };
  const params = new URLSearchParams();

  if (next.availability !== 'all') {
    params.set('availability', next.availability);
  }
  if (next.deliveryDate && next.returnDate) {
    params.set('from', next.deliveryDate);
    params.set('to', next.returnDate);
  }
  if (next.vehicleId) {
    params.set('vehicle', next.vehicleId);
  }
  if (next.page > 1) {
    params.set('page', String(next.page));
  }

  const query = params.toString();
  return query ? `/?${query}` : '/';
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
