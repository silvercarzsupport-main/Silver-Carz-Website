import { CheckCircle2, Phone } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { customerBookingContinuePath } from '@/constants/routes';
import { calculateRentalDays } from '@/features/customer-booking/lib/estimate';
import { hasValidBrowseDates } from '@/features/vehicles/lib/public-vehicle-list-params';
import { VehicleThumbnail } from '@/features/vehicles/components/vehicle-thumbnail';
import { buildCustomerLoginRedirectPath } from '@/lib/auth/route-guards';
import { formatCurrency, formatDate } from '@/lib/format';
import type { PublicVehicle } from '@/types';
import { FUEL_TYPE_LABELS, TRANSMISSION_TYPE_LABELS } from '@/types/enums';

/**
 * Trust items shown beside the booking summary.
 * Every claim here must stay consistent with the official Silver Carz
 * Terms & Conditions (see the About Us page) — no unverifiable promises.
 */
const TRUST_ITEMS = [
  'Transparent Daily Rates',
  'GPS-Monitored Vehicles',
  'Admin-Approved Bookings',
  'Secure Online Payments',
] as const;

export function BookingSummaryPanel({
  vehicle,
  isAuthenticated,
  deliveryDate = null,
  returnDate = null,
}: {
  vehicle: PublicVehicle | null;
  isAuthenticated: boolean;
  deliveryDate?: string | null;
  returnDate?: string | null;
}) {
  const rate = vehicle
    ? formatCurrency(Number(vehicle.default_daily_rate), { maximumFractionDigits: 0 })
    : null;

  const datesReady = hasValidBrowseDates({
    availability: 'all',
    deliveryDate,
    returnDate,
    vehicleId: null,
    page: 1,
  });

  const rentalDays =
    datesReady && deliveryDate && returnDate ? calculateRentalDays(deliveryDate, returnDate) : null;

  const continueHref =
    vehicle && datesReady
      ? isAuthenticated
        ? customerBookingContinuePath(vehicle.id, 'details', {
            deliveryDate,
            returnDate,
          })
        : buildCustomerLoginRedirectPath(
            customerBookingContinuePath(vehicle.id, 'details', {
              deliveryDate,
              returnDate,
            }),
          )
      : null;

  const ctaLabel = isAuthenticated ? 'Your details →' : 'Continue →';

  return (
    <aside className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="bg-secondary px-4 py-3">
        <h2 className="text-sm font-bold tracking-wide text-secondary-foreground uppercase">
          Your Booking
        </h2>
      </div>

      <div className="space-y-5 p-4">
        {vehicle ? (
          <div className="flex gap-3">
            <VehicleThumbnail
              imagePath={vehicle.image_path}
              alt={vehicle.vehicle_name}
              fit="contain"
              className="h-16 w-24 rounded-md bg-surface-secondary"
            />
            <div className="min-w-0">
              <p className="truncate font-bold text-foreground">{vehicle.vehicle_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {FUEL_TYPE_LABELS[vehicle.fuel_type]} ·{' '}
                {TRANSMISSION_TYPE_LABELS[vehicle.transmission_type]}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-md bg-muted/60 px-3 py-4 text-sm text-muted-foreground">
            Select a car from the list to start your booking summary.
          </p>
        )}

        <div className="space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Pickup</span>
            <span className="font-medium text-foreground">
              {datesReady && deliveryDate ? formatDate(deliveryDate) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Return</span>
            <span className="font-medium text-foreground">
              {datesReady && returnDate ? formatDate(returnDate) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium text-foreground">
              {rentalDays ? `${rentalDays} day${rentalDays === 1 ? '' : 's'}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Estimated price</span>
            <span className="font-bold text-foreground">{rate ? `${rate} /day` : '—'}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {datesReady
              ? 'Final quote is confirmed when you submit your booking request.'
              : 'Choose pickup and return dates above to continue.'}
          </p>
        </div>

        {continueHref ? (
          <Button
            asChild
            className="h-11 w-full rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
          >
            <Link href={continueHref}>{ctaLabel}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            className="h-11 w-full rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase opacity-80"
          >
            {vehicle ? (datesReady ? ctaLabel : 'Select dates →') : 'Select dates →'}
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          {vehicle
            ? datesReady
              ? isAuthenticated
                ? 'Next: enter your details and submit a request for approval.'
                : 'Sign in or create an account to continue with this car.'
              : 'Set pickup and return dates in the filters to continue.'
            : 'Select dates and a vehicle to continue.'}
        </p>

        <ul className="space-y-2 border-t border-border pt-4">
          {TRUST_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-2 rounded-md bg-tone-gold/80 px-3 py-3 text-tone-gold-foreground">
          <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold uppercase">Need Help?</p>
            <p className="mt-0.5 text-xs opacity-80">
              Support contact details will be published when available.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
