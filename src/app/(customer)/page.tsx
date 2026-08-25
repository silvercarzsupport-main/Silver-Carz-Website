import type { Metadata } from 'next';
import { Suspense } from 'react';

import { BookACarSkeleton } from '@/components/customer/book-a-car/book-a-car-skeleton';
import { BookACarView } from '@/components/customer/book-a-car/book-a-car-view';
import { appConfig, citiesMatch } from '@/config';
import { readBookingCity } from '@/features/customer-location/lib/booking-city-cookie';
import {
  getPublicVehicle,
  listPublicVehicles,
} from '@/features/vehicles/actions/list-public-vehicles';
import {
  hasValidBrowseDates,
  parseCustomerBookACarUrlState,
  toPublicVehicleListQuery,
} from '@/features/vehicles/lib/public-vehicle-list-params';
import { listBusyVehicleIdsForRange } from '@/features/vehicles/service/list-busy-vehicle-ids';
import { getAuthState } from '@/lib/auth';
import type { PublicVehicle } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `Book a Car | ${appConfig.companyName}`,
  description: 'Browse the Silver Carz fleet and select a car to book.',
};

/**
 * Root customer page — Book a Car (single source of truth).
 * Browse, filter, select, summary. Fleet is scoped to the visitor's booking city.
 */
export default async function BookACarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <Suspense fallback={<BookACarSkeleton />}>
      <BookACarPageContent searchParams={params} />
    </Suspense>
  );
}

async function BookACarPageContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const state = parseCustomerBookACarUrlState(searchParams);
  const [authState, bookingCity] = await Promise.all([getAuthState(), readBookingCity()]);
  const isAuthenticated = Boolean(authState.profile?.isActive);

  if (!bookingCity) {
    return (
      <BookACarView
        state={state}
        vehicles={[]}
        meta={null}
        selectedVehicle={null}
        isAuthenticated={isAuthenticated}
        bookingCity={null}
      />
    );
  }

  let excludeIds: readonly string[] | undefined;
  if (hasValidBrowseDates(state) && state.deliveryDate && state.returnDate) {
    const busy = await listBusyVehicleIdsForRange({
      deliveryDate: state.deliveryDate,
      returnDate: state.returnDate,
    });
    if (busy.success && busy.data.length > 0) {
      excludeIds = busy.data;
    }
  }

  const result = await listPublicVehicles(
    toPublicVehicleListQuery(state, bookingCity, { excludeIds }),
  );

  if (!result.success) {
    return (
      <BookACarView
        state={state}
        vehicles={[]}
        meta={null}
        selectedVehicle={null}
        isAuthenticated={isAuthenticated}
        errorMessage={result.error.message}
        bookingCity={bookingCity}
      />
    );
  }

  const vehicles = result.data.data;
  const selectedVehicle = await resolveSelectedVehicle(vehicles, state.vehicleId, bookingCity);

  return (
    <BookACarView
      state={state}
      vehicles={vehicles}
      meta={result.data.meta}
      selectedVehicle={selectedVehicle}
      isAuthenticated={isAuthenticated}
      bookingCity={bookingCity}
    />
  );
}

async function resolveSelectedVehicle(
  vehicles: readonly PublicVehicle[],
  vehicleId: string | null,
  bookingCity: string,
): Promise<PublicVehicle | null> {
  if (!vehicleId) {
    return null;
  }

  const onPage = vehicles.find((vehicle) => vehicle.id === vehicleId);
  if (onPage) {
    return citiesMatch(onPage.city, bookingCity) ? onPage : null;
  }

  const selected = await getPublicVehicle(vehicleId);
  if (!selected.success || !citiesMatch(selected.data.city, bookingCity)) {
    return null;
  }

  return selected.data;
}
