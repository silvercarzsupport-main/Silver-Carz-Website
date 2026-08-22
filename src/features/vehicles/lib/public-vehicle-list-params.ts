/**
 * Customer Book a Car URL state ↔ VehicleListQuery mapping.
 *
 * Booking city is cookie-backed (location prompt), not a public URL param.
 */

import type { VehicleListQuery } from '@/types/vehicle';
import { isVehicleAvailabilityStatus } from '@/types/enums';

export type CustomerPriceFilter = 'all' | 'under-2000' | '2000-4000' | '4000-plus';
export type CustomerAvailabilityFilter = 'all' | 'available';

export interface CustomerBookACarUrlState {
  readonly availability: CustomerAvailabilityFilter;
  readonly price: CustomerPriceFilter;
  readonly vehicleId: string | null;
  readonly page: number;
}

const PRICE_BOUNDS: Record<
  Exclude<CustomerPriceFilter, 'all'>,
  { minDailyRate?: number; maxDailyRate?: number }
> = {
  'under-2000': { maxDailyRate: 1999.99 },
  '2000-4000': { minDailyRate: 2000, maxDailyRate: 4000 },
  '4000-plus': { minDailyRate: 4000.01 },
};

function parsePrice(value: string | undefined): CustomerPriceFilter {
  if (value === 'under-2000' || value === '2000-4000' || value === '4000-plus') {
    return value;
  }
  return 'all';
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
  const priceRaw = firstParam(searchParams.price);
  const vehicleRaw = firstParam(searchParams.vehicle);
  const pageRaw = firstParam(searchParams.page);
  const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);

  return {
    availability: parseAvailability(availabilityRaw),
    price: parsePrice(priceRaw),
    vehicleId: vehicleRaw?.trim() || null,
    page,
  };
}

export function toPublicVehicleListQuery(
  state: CustomerBookACarUrlState,
  city: string,
): VehicleListQuery {
  const priceBounds = state.price === 'all' ? {} : PRICE_BOUNDS[state.price];

  return {
    isActive: true,
    available: state.availability === 'available' ? true : undefined,
    city,
    ...priceBounds,
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
  if (next.price !== 'all') {
    params.set('price', next.price);
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
