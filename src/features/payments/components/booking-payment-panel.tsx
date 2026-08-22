'use client';

/**
 * Customer payment summary + Razorpay Checkout (C6).
 * Never marks booking confirmed from browser callbacks.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { customerBookingConfirmationPath, customerBookingPath, ROUTES } from '@/constants/routes';
import {
  confirmBookingPayment,
  createBookingPaymentCheckout,
  markBookingPaymentCancelled,
  markBookingPaymentFailed,
} from '@/features/payments/actions';
import type { PaymentEligibility } from '@/features/payments/lib/eligibility';
import { SelectedVehicleSummary } from '@/features/customer-booking/components/selected-vehicle-summary';
import { calculateRentalDays } from '@/features/customer-booking/lib/estimate';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import type { BookingWithVehicle, PaymentSummary, RazorpayCheckoutSession } from '@/types';

type BookingPaymentPanelProps = {
  readonly booking: BookingWithVehicle;
  readonly eligibility: PaymentEligibility;
  readonly payments: readonly PaymentSummary[];
};

type CheckoutStatus = 'idle' | 'creating' | 'opening' | 'failed' | 'cancelled';

type RazorpaySuccessResponse = {
  readonly razorpay_payment_id?: string;
  readonly razorpay_order_id?: string;
  readonly razorpay_signature?: string;
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay requires a browser.'));
  }
  if (window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay.'));
    document.body.appendChild(script);
  });
}

export function BookingPaymentPanel({ booking, eligibility, payments }: BookingPaymentPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inFlightRef = useRef(false);
  const checkoutSucceededRef = useRef(false);

  const durationDays =
    booking.duration != null
      ? Number(booking.duration)
      : calculateRentalDays(booking.delivery_date, booking.return_date);

  const busy = status === 'creating' || status === 'opening' || isPending;
  const latestFailed = payments.find((payment) => payment.status === 'failed');

  useEffect(() => {
    return () => {
      inFlightRef.current = false;
    };
  }, []);

  function openCheckout(session: RazorpayCheckoutSession) {
    startTransition(async () => {
      setStatus('opening');
      setErrorMessage(null);

      try {
        await loadRazorpayScript();
        if (!window.Razorpay) {
          throw new Error('Payment gateway unavailable.');
        }

        const rzp = new window.Razorpay({
          key: session.keyId,
          amount: session.amountPaise,
          currency: session.currency,
          name: 'Silver Carz',
          description: session.description,
          order_id: session.orderId,
          prefill: {
            name: session.customerName,
            contact: session.customerContact ?? undefined,
          },
          notes: {
            booking_id: session.bookingId,
            payment_id: session.paymentId,
          },
          theme: {
            color: '#F4B400',
          },
          modal: {
            ondismiss: () => {
              if (checkoutSucceededRef.current) {
                return;
              }
              void markBookingPaymentCancelled({ paymentId: session.paymentId }).finally(() => {
                setStatus('cancelled');
                setErrorMessage('Payment was not completed. You can try again when ready.');
                inFlightRef.current = false;
                router.refresh();
              });
            },
          },
          handler: (response: RazorpaySuccessResponse) => {
            checkoutSucceededRef.current = true;
            const orderId = response.razorpay_order_id ?? session.orderId;
            const paymentId = response.razorpay_payment_id ?? '';
            const signature = response.razorpay_signature ?? '';

            void confirmBookingPayment({
              bookingId: session.bookingId,
              razorpayOrderId: orderId,
              razorpayPaymentId: paymentId,
              razorpaySignature: signature,
            })
              .then((result) => {
                if (result.success) {
                  router.push(customerBookingConfirmationPath(session.bookingId));
                  return;
                }

                checkoutSucceededRef.current = false;
                setStatus('failed');
                setErrorMessage(
                  result.error.message ||
                    'Payment could not be confirmed. Please try again or contact Silver Carz.',
                );
              })
              .catch(() => {
                checkoutSucceededRef.current = false;
                setStatus('failed');
                setErrorMessage(
                  'Payment could not be confirmed. Please try again or contact Silver Carz.',
                );
              })
              .finally(() => {
                setStatus((current) => (current === 'opening' ? 'idle' : current));
                inFlightRef.current = false;
              });
          },
        });

        rzp.on('payment.failed', (response) => {
          const reason = response.error?.description ?? 'Payment failed at the gateway.';
          void markBookingPaymentFailed({
            paymentId: session.paymentId,
            reason,
          }).finally(() => {
            setStatus('failed');
            setErrorMessage('Your payment was not completed. You can try again.');
            inFlightRef.current = false;
            router.refresh();
          });
        });

        rzp.open();
      } catch {
        setStatus('failed');
        setErrorMessage('Unable to open the payment gateway. Please try again.');
        inFlightRef.current = false;
      }
    });
  }

  function handlePayNow() {
    if (inFlightRef.current || busy || !eligibility.canPay) {
      return;
    }

    inFlightRef.current = true;
    checkoutSucceededRef.current = false;
    setStatus('creating');
    setErrorMessage(null);

    startTransition(async () => {
      const result = await createBookingPaymentCheckout(booking.id);
      if (!result.success) {
        setStatus('failed');
        setErrorMessage(result.error.message);
        inFlightRef.current = false;
        return;
      }

      openCheckout(result.data);
    });
  }

  if (!eligibility.canPay) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Payment
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
            {eligibility.title}
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {eligibility.description}
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="h-11 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
          >
            <Link
              href={
                eligibility.state === 'already_paid'
                  ? customerBookingConfirmationPath(booking.id)
                  : customerBookingPath(booking.id)
              }
            >
              {eligibility.state === 'already_paid' ? 'View booking' : 'Back to booking'}
            </Link>
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

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Payment
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
          {eligibility.title}
        </h1>
        <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
          {eligibility.description}
        </p>
      </header>

      <section
        className="space-y-4 rounded-lg border border-border bg-card p-5 sm:p-6"
        aria-labelledby="payment-summary-heading"
      >
        <h2 id="payment-summary-heading" className="sr-only">
          Payment summary
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Booking number
            </p>
            <p className="mt-1 text-xl font-bold tracking-wide text-foreground">
              {booking.invoice_number}
            </p>
          </div>
          <p className="text-right">
            <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Amount payable now
            </span>
            <span className="mt-1 block text-2xl font-bold text-foreground tabular-nums">
              {formatCurrency(eligibility.amountPayable, { maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>

        <SelectedVehicleSummary vehicle={booking.vehicle} />

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Pickup date
            </dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {formatDate(booking.delivery_date)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Return date
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
              Booking amount
            </dt>
            <dd className="mt-1 text-sm font-semibold text-foreground tabular-nums">
              {formatCurrency(Number(booking.total_amount), { maximumFractionDigits: 0 })}
            </dd>
          </div>
          {booking.payment_due_at ? (
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Pay by
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {formatDateTime(booking.payment_due_at)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {errorMessage || latestFailed ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-destructive">
            {errorMessage ?? 'Payment failed'}
          </p>
          {!errorMessage && latestFailed ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Your payment was not completed. You can try again.
            </p>
          ) : null}
        </div>
      ) : null}

      {status === 'cancelled' ? (
        <div
          className="rounded-lg border border-border bg-muted/40 p-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-foreground">Payment cancelled</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No charge was completed. Your booking remains approved and you can pay when ready.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <Button
          type="button"
          className="h-12 w-full rounded-md bg-primary text-base font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90 sm:w-auto sm:min-w-[14rem]"
          disabled={busy}
          aria-busy={busy}
          onClick={handlePayNow}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {status === 'opening' ? 'Opening gateway' : 'Creating payment'}
            </>
          ) : status === 'failed' || status === 'cancelled' || latestFailed ? (
            'Try again'
          ) : (
            'Pay now'
          )}
        </Button>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Payments are securely processed by our payment provider.</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          asChild
          variant="outline"
          className="h-11 rounded-md border-secondary text-secondary"
        >
          <Link href={customerBookingPath(booking.id)}>Back to booking</Link>
        </Button>
        <Button asChild variant="ghost" className="h-11 rounded-md">
          <Link href={ROUTES.myBookings}>My bookings</Link>
        </Button>
      </div>
    </div>
  );
}
