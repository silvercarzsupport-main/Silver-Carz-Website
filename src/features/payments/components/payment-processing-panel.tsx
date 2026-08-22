'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { customerBookingPath, ROUTES } from '@/constants/routes';
import { getBookingPaymentPageData } from '@/features/payments/actions';

type PaymentProcessingPanelProps = {
  readonly bookingId: string;
  readonly invoiceNumber: string;
};

/**
 * Post-gateway return state. Polls until C7 marks the payment paid.
 */
export function PaymentProcessingPanel({ bookingId, invoiceNumber }: PaymentProcessingPanelProps) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const tick = async () => {
      attempts += 1;
      const result = await getBookingPaymentPageData(bookingId);
      if (cancelled) {
        return;
      }

      if (result.success && result.data.eligibility.state === 'already_paid') {
        router.refresh();
        return;
      }

      if (attempts >= maxAttempts) {
        setTimedOut(true);
      }
    };

    void tick();
    const interval = window.setInterval(() => {
      if (attempts >= maxAttempts) {
        window.clearInterval(interval);
        return;
      }
      void tick();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [bookingId, router]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-1 size-8 shrink-0 text-tone-gold-foreground" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Payment
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
            {timedOut ? 'Still verifying' : 'Confirming payment'}
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {timedOut
              ? `We are still confirming payment for booking ${invoiceNumber}. This page will update once verification finishes.`
              : `Payment received — confirming booking ${invoiceNumber}. This usually takes a few seconds.`}
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
          Silver Carz verifies the payment with the provider. Your booking is confirmed as soon as
          that check succeeds — you do not need to pay again.
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
