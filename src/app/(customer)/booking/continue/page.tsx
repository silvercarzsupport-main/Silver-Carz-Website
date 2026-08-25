import type { Metadata } from 'next';
import Link from 'next/link';

import { BookingProgressSteps } from '@/components/customer/book-a-car/booking-progress-steps';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { appConfig, citiesMatch } from '@/config';
import { customerBookingContinuePath, ROUTES } from '@/constants/routes';
import { BookingRequestWizard } from '@/features/customer-booking/components/booking-request-wizard';
import { parseBookingWizardStep } from '@/features/customer-booking/lib/wizard-step';
import { readBookingCity } from '@/features/customer-location/lib/booking-city-cookie';
import { getPublicVehicle } from '@/features/vehicles/actions/list-public-vehicles';
import {
  hasValidBrowseDates,
  parseCustomerBookACarUrlState,
} from '@/features/vehicles/lib/public-vehicle-list-params';
import { APP_ROLES, getCurrentProfile, requireCustomerAuth } from '@/lib/auth';

export const metadata: Metadata = {
  title: `Book a car | ${appConfig.companyName}`,
  description: 'Select dates and submit your Silver Carz booking request.',
};

export const dynamic = 'force-dynamic';

/**
 * Authenticated booking request wizard (C3).
 * Preserves vehicle selection (and optional dates) from Book a Car.
 */
export default async function BookingContinuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const vehicleId = firstParam(params.vehicle);
  const browseDates = parseCustomerBookACarUrlState({
    from: params.from,
    to: params.to,
  });
  const datesFromBrowse = hasValidBrowseDates(browseDates);
  const stepParam = parseBookingWizardStep(params.step);
  // With browse dates and no explicit step, skip the calendar step.
  const step = datesFromBrowse && !firstParam(params.step) ? 'details' : stepParam;
  const nextPath = vehicleId
    ? customerBookingContinuePath(
        vehicleId,
        step,
        datesFromBrowse
          ? { deliveryDate: browseDates.deliveryDate, returnDate: browseDates.returnDate }
          : undefined,
      )
    : ROUTES.bookingContinue;

  const user = await requireCustomerAuth(nextPath);

  if (!vehicleId) {
    return (
      <>
        <BookingProgressSteps activeStep={2} />
        <CustomerContainer className="max-w-2xl py-10 sm:py-14">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Booking
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
            Select a car first
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Choose a vehicle on Book a Car before selecting dates and submitting a request.
          </p>
          <div className="mt-8">
            <Button
              asChild
              className="h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
            >
              <Link href={ROUTES.bookACar}>Browse cars</Link>
            </Button>
          </div>
        </CustomerContainer>
      </>
    );
  }

  if (user.role !== APP_ROLES.customer) {
    return (
      <>
        <BookingProgressSteps activeStep={2} />
        <CustomerContainer className="max-w-2xl py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
            Customer account required
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Booking requests are submitted from a customer account. Staff should create bookings in
            the Admin Portal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              className="h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
            >
              <Link href={ROUTES.bookingsNew}>Admin new booking</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-md">
              <Link href={ROUTES.bookACar}>Back to Book a Car</Link>
            </Button>
          </div>
        </CustomerContainer>
      </>
    );
  }

  const vehicleResult = await getPublicVehicle(vehicleId);
  const bookingCity = await readBookingCity();
  const profile = await getCurrentProfile();

  if (!vehicleResult.success) {
    return (
      <>
        <BookingProgressSteps activeStep={2} />
        <CustomerContainer className="max-w-2xl py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
            Vehicle unavailable
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {vehicleResult.error.message ||
              'This vehicle is no longer available. Please choose another car.'}
          </p>
          <div className="mt-8">
            <Button
              asChild
              className="h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
            >
              <Link href={ROUTES.bookACar}>Browse cars</Link>
            </Button>
          </div>
        </CustomerContainer>
      </>
    );
  }

  if (bookingCity && !citiesMatch(vehicleResult.data.city, bookingCity)) {
    return (
      <>
        <BookingProgressSteps activeStep={2} />
        <CustomerContainer className="max-w-2xl py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
            Car not available in {bookingCity}
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            This vehicle is stationed in {vehicleResult.data.city}. Choose a car from the{' '}
            {bookingCity} fleet to continue.
          </p>
          <div className="mt-8">
            <Button
              asChild
              className="h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
            >
              <Link href={ROUTES.bookACar}>Browse cars</Link>
            </Button>
          </div>
        </CustomerContainer>
      </>
    );
  }

  return (
    <BookingRequestWizard
      vehicle={vehicleResult.data}
      initialCustomerName={user.fullName?.trim() || ''}
      customerEmail={user.email ?? ''}
      initialContactNumber={profile?.phone ?? ''}
      initialWhatsAppUpdates={profile?.whatsappOptIn ?? true}
      initialStep={step}
      initialCity={bookingCity || vehicleResult.data.city}
      initialDeliveryDate={datesFromBrowse ? browseDates.deliveryDate : null}
      initialReturnDate={datesFromBrowse ? browseDates.returnDate : null}
    />
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
