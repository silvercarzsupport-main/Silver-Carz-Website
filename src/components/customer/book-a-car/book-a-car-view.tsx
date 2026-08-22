import Link from 'next/link';
import { CarFront } from 'lucide-react';

import { BookACarFilters } from '@/components/customer/book-a-car/book-a-car-filters';
import { BookACarHero } from '@/components/customer/book-a-car/book-a-car-hero';
import { BookingProgressSteps } from '@/components/customer/book-a-car/booking-progress-steps';
import { BookingSummaryPanel } from '@/components/customer/book-a-car/booking-summary-panel';
import { VehicleBrowseCard } from '@/components/customer/book-a-car/vehicle-browse-card';
import { WhyBookBar } from '@/components/customer/book-a-car/why-book-bar';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { BookingLocationGate } from '@/features/customer-location/components/booking-location-gate';
import {
  buildCustomerBookACarSearchParams,
  type CustomerBookACarUrlState,
} from '@/features/vehicles/lib/public-vehicle-list-params';
import type { PaginationMeta, PublicVehicle } from '@/types';

export function BookACarView({
  state,
  vehicles,
  meta,
  selectedVehicle,
  isAuthenticated = false,
  errorMessage,
  bookingCity,
}: {
  state: CustomerBookACarUrlState;
  vehicles: readonly PublicVehicle[];
  meta: PaginationMeta | null;
  selectedVehicle: PublicVehicle | null;
  isAuthenticated?: boolean;
  errorMessage?: string | null;
  bookingCity: string | null;
}) {
  const needsLocation = !bookingCity;

  return (
    <>
      <BookACarHero />
      <BookingProgressSteps activeStep={1} />

      <CustomerContainer className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:py-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground uppercase sm:text-2xl">
              Choose Your Car
            </h2>
            <div className="mt-2 h-1 w-12 bg-primary" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">
              {bookingCity
                ? `Browse the active fleet stationed in ${bookingCity}.`
                : 'Choose your city to see cars available for pick-up there.'}
            </p>
          </div>

          <BookingLocationGate bookingCity={bookingCity} />

          {!needsLocation ? <BookACarFilters state={state} /> : null}

          {errorMessage ? (
            <ErrorState title="Unable to load vehicles" description={errorMessage} />
          ) : null}

          {!errorMessage && needsLocation ? (
            <EmptyState
              icon={CarFront}
              title="Choose your city to browse cars"
              description="Select the city in India where you want to pick up a car."
            />
          ) : null}

          {!errorMessage && !needsLocation && vehicles.length === 0 ? (
            <EmptyState
              icon={CarFront}
              title={`No cars in ${bookingCity}`}
              description="Try a different availability or price filter, or change city if you are booking elsewhere."
              action={
                <Button asChild variant="outline" className="rounded-md">
                  <Link href="/" scroll={false}>
                    Clear filters
                  </Link>
                </Button>
              }
            />
          ) : null}

          {!errorMessage && !needsLocation && vehicles.length > 0 ? (
            <ul className="space-y-3">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  <VehicleBrowseCard
                    vehicle={vehicle}
                    state={state}
                    selected={selectedVehicle?.id === vehicle.id}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 pt-2">
              {meta.hasPreviousPage ? (
                <Button asChild variant="outline" className="rounded-md">
                  <Link
                    href={buildCustomerBookACarSearchParams(state, {
                      page: Math.max(1, state.page - 1),
                    })}
                    scroll={false}
                  >
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="rounded-md" disabled>
                  Previous
                </Button>
              )}
              <p className="text-xs text-muted-foreground sm:text-sm">
                Page {meta.page} of {meta.totalPages}
              </p>
              {meta.hasNextPage ? (
                <Button asChild variant="outline" className="rounded-md">
                  <Link
                    href={buildCustomerBookACarSearchParams(state, {
                      page: state.page + 1,
                    })}
                    scroll={false}
                  >
                    Next
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="rounded-md" disabled>
                  Next
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-24">
          <BookingSummaryPanel vehicle={selectedVehicle} isAuthenticated={isAuthenticated} />
        </div>
      </CustomerContainer>

      <WhyBookBar />
    </>
  );
}
