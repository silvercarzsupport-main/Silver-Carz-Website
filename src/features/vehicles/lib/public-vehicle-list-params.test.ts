import { describe, expect, it } from 'vitest';

import {
  buildCustomerBookACarSearchParams,
  hasValidBrowseDates,
  parseCustomerBookACarUrlState,
  toPublicVehicleListQuery,
  validateBrowseDateRange,
} from '@/features/vehicles/lib/public-vehicle-list-params';

describe('public-vehicle-list-params date filters', () => {
  it('parses valid from/to into delivery and return dates', () => {
    const state = parseCustomerBookACarUrlState({
      from: '2099-06-10',
      to: '2099-06-12',
    });

    // Far-future dates fail the booking horizon — treated as unset.
    expect(state.deliveryDate).toBeNull();
    expect(state.returnDate).toBeNull();
  });

  it('accepts dates within a fixed horizon window', () => {
    expect(validateBrowseDateRange('2026-08-26', '2026-08-28', '2026-08-26')).toBeNull();
    expect(validateBrowseDateRange('2026-08-28', '2026-08-26', '2026-08-26')).toMatch(
      /on or after pickup/i,
    );
    expect(validateBrowseDateRange('2026-08-20', '2026-08-28', '2026-08-26')).toMatch(/past/i);
  });

  it('serializes from/to and clears price-style params', () => {
    const href = buildCustomerBookACarSearchParams({
      availability: 'available',
      deliveryDate: '2026-08-26',
      returnDate: '2026-08-28',
      vehicleId: 'veh-1',
      page: 2,
    });

    expect(href).toContain('availability=available');
    expect(href).toContain('from=2026-08-26');
    expect(href).toContain('to=2026-08-28');
    expect(href).toContain('vehicle=veh-1');
    expect(href).toContain('page=2');
    expect(href).not.toContain('price=');
  });

  it('maps excludeIds into the public list query', () => {
    const state = {
      availability: 'all' as const,
      deliveryDate: '2026-08-26',
      returnDate: '2026-08-28',
      vehicleId: null,
      page: 1,
    };
    expect(hasValidBrowseDates(state)).toBe(true);

    const query = toPublicVehicleListQuery(state, 'Nagpur', {
      excludeIds: ['a', 'b'],
    });

    expect(query.city).toBe('Nagpur');
    expect(query.excludeIds).toEqual(['a', 'b']);
    expect(query.minDailyRate).toBeUndefined();
  });
});
