import Link from 'next/link';

import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import {
  customerBookingDocumentsPath,
  customerBookingPath,
  ROUTES,
} from '@/constants/routes';
import { MyBookingsSubmitToast } from '@/features/customer-booking/components/my-bookings-submit-toast';
import {
  customerRequestStatusToneClass,
  getCustomerRequestStatusPresentation,
} from '@/features/customer-booking/lib/request-status';
import { VehicleThumbnail } from '@/features/vehicles/components/vehicle-thumbnail';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BookingWithVehicle } from '@/types';
import { BOOKING_STATUSES, RENTAL_MODE_LABELS } from '@/types/enums';

function bookingHref(booking: BookingWithVehicle): string {
  if (booking.status === BOOKING_STATUSES.draft && !booking.document_submitted) {
    return customerBookingDocumentsPath(booking.id);
  }
  const status = getCustomerRequestStatusPresentation(booking);
  return customerBookingPath(booking.id);
}

export function MyBookingsList({ bookings }: { readonly bookings: readonly BookingWithVehicle[] }) {
  return (
    <CustomerContainer className="max-w-4xl py-10 sm:py-14">
      <MyBookingsSubmitToast />

      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Account
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
          My Bookings
        </h1>
        <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
        <p className="mt-5 text-base text-muted-foreground">
          Track every booking request — pending review, approved, rejected, and past hires.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="mt-10 rounded-lg border border-border bg-card p-6 sm:p-8">
          <p className="text-lg font-semibold text-foreground">No bookings yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            When you submit a booking request, it will appear here with its review status.
          </p>
          <Button
            asChild
            className="mt-6 h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
          >
            <Link href={ROUTES.bookACar}>Book a car</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {bookings.map((booking) => {
            const status = getCustomerRequestStatusPresentation(booking);

            return (
              <li key={booking.id}>
                <article className="rounded-lg border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <VehicleThumbnail
                        imagePath={booking.vehicle.image_path}
                        alt={booking.vehicle.vehicle_name}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {booking.invoice_number}
                        </p>
                        <h2 className="mt-1 truncate text-lg font-bold text-foreground">
                          {booking.vehicle.vehicle_name}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(booking.delivery_date)} → {formatDate(booking.return_date)}
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          {RENTAL_MODE_LABELS[booking.mode]}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {formatCurrency(Number(booking.total_amount), {
                            maximumFractionDigits: 0,
                          })}
                        </p>
                        <p className="mt-2 max-w-md text-xs text-muted-foreground">
                          {status.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <span
                        className={cn(
                          'rounded-md px-3 py-1.5 text-xs font-bold tracking-wide uppercase',
                          customerRequestStatusToneClass(status.tone),
                        )}
                      >
                        {status.label}
                      </span>
                      {status.paymentLabel ? (
                        <span className="rounded-md bg-muted px-3 py-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                          {status.paymentLabel}
                        </span>
                      ) : null}
                      <Button asChild variant="outline" className="h-10 rounded-md">
                        <Link href={bookingHref(booking)}>{status.ctaLabel}</Link>
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </CustomerContainer>
  );
}
