import Link from 'next/link';
import { Clock3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { customerBookingPath, ROUTES } from '@/constants/routes';

type PaymentProcessingPanelProps = {
  readonly bookingId: string;
  readonly invoiceNumber: string;
};

/**
 * Post-gateway return state (C6).
 * Does not claim booking confirmation — that is C7.
 */
export function PaymentProcessingPanel({ bookingId, invoiceNumber }: PaymentProcessingPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-1 size-8 shrink-0 text-tone-gold-foreground" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Payment
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
            Payment processing
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Payment submitted — verification pending for booking{' '}
            <span className="font-semibold text-foreground">{invoiceNumber}</span>. This does not
            confirm your booking yet.
          </p>
        </div>
      </div>

      <div
        className="rounded-lg border border-border bg-card p-5 sm:p-6"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-foreground">What happens next</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Silver Carz will verify the payment with the payment provider. Once verified, your booking
          confirmation will appear here.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          className="h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
        >
          <Link href={customerBookingPath(bookingId)}>View booking</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-11 rounded-md border-secondary text-secondary"
        >
          <Link href={ROUTES.myBookings}>My bookings</Link>
        </Button>
      </div>
    </div>
  );
}
