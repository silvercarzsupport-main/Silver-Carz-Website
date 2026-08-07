import Link from 'next/link';
import { Ban, CheckCircle2, CircleDashed } from 'lucide-react';

import { BookingProgressSteps } from '@/components/customer/book-a-car/booking-progress-steps';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { customerBookingPaymentPath, ROUTES } from '@/constants/routes';
import { SelectedVehicleSummary } from '@/features/customer-booking/components/selected-vehicle-summary';
import { calculateRentalDays } from '@/features/customer-booking/lib/estimate';
import {
  customerRequestStatusToneClass,
  getCustomerRequestStatusPresentation,
} from '@/features/customer-booking/lib/request-status';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BookingWithVehicle } from '@/types';
import { RENTAL_MODE_LABELS } from '@/types/enums';

type BookingRequestStatusProps = {
  readonly booking: BookingWithVehicle;
};

function StatusIcon({ tone }: { readonly tone: 'pending' | 'success' | 'muted' | 'danger' }) {
  if (tone === 'success') {
    return <CheckCircle2 className="mt-1 size-8 shrink-0 text-success" aria-hidden="true" />;
  }
  if (tone === 'danger') {
    return <Ban className="mt-1 size-8 shrink-0 text-destructive" aria-hidden="true" />;
  }
  return <CircleDashed className="mt-1 size-8 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

/**
 * Customer detail for a booking request after admin review (approved, denied, etc.).
 */
export function BookingRequestStatus({ booking }: BookingRequestStatusProps) {
  const status = getCustomerRequestStatusPresentation(booking);
  const durationDays =
    booking.duration != null
      ? Number(booking.duration)
      : calculateRentalDays(booking.delivery_date, booking.return_date);

  const title =
    status.tone === 'success'
      ? status.paymentAvailable
        ? 'Booking approved'
        : 'Booking confirmed'
      : status.tone === 'danger'
        ? status.label === 'Request rejected'
          ? 'Request rejected'
          : 'Booking cancelled'
        : 'Booking details';

  return (
    <>
      <BookingProgressSteps activeStep={5} />

      <CustomerContainer className="max-w-3xl py-10 sm:py-14">
        <div className="flex items-start gap-3">
          <StatusIcon tone={status.tone} />
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Booking history
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
              {title}
            </h1>
            <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {status.description}
            </p>
            {status.paymentAvailable ? (
              <p className="mt-3 text-sm font-semibold text-success">
                Your booking has been approved. Payment is required.
              </p>
            ) : null}
          </div>
        </div>

        {status.rejectionReason ? (
          <div
            className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
            role="status"
          >
            <p className="text-xs font-semibold tracking-wide text-destructive uppercase">
              Rejection reason
            </p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {status.rejectionReason}
            </p>
          </div>
        ) : null}

        <div className="mt-8 space-y-4 rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Booking request number
              </p>
              <p className="mt-1 text-xl font-bold tracking-wide text-foreground">
                {booking.invoice_number}
              </p>
            </div>
            <span
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-bold tracking-wide uppercase',
                customerRequestStatusToneClass(status.tone),
              )}
            >
              {status.label}
            </span>
          </div>

          <SelectedVehicleSummary vehicle={booking.vehicle} />

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Pickup
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {formatDate(booking.delivery_date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Return
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {formatDate(booking.return_date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Duration
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {durationDays} {durationDays === 1 ? 'day' : 'days'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Mode
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {RENTAL_MODE_LABELS[booking.mode]}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Total
              </dt>
              <dd className="mt-1 text-lg font-bold text-foreground">
                {formatCurrency(Number(booking.total_amount), { maximumFractionDigits: 0 })}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {status.paymentAvailable ? (
            <Button
              asChild
              className="h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
            >
              <Link href={customerBookingPaymentPath(booking.id)}>Pay now</Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant={status.paymentAvailable ? 'outline' : 'default'}
            className={
              status.paymentAvailable
                ? 'h-11 rounded-md border-secondary text-secondary'
                : 'h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90'
            }
          >
            <Link href={ROUTES.myBookings}>My bookings</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-md border-secondary text-secondary"
          >
            <Link href={ROUTES.bookACar}>Browse more cars</Link>
          </Button>
        </div>
      </CustomerContainer>
    </>
  );
}
