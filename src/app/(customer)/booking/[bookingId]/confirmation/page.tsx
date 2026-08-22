import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BookingProgressSteps } from '@/components/customer/book-a-car/booking-progress-steps';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { appConfig } from '@/config';
import {
  customerBookingConfirmationPath,
  customerBookingPaymentPath,
  customerBookingPath,
  ROUTES,
} from '@/constants/routes';
import { getBookingPaymentPageData, PaymentProcessingPanel } from '@/features/payments';
import { APP_ROLES, requireCustomerAuth } from '@/lib/auth';
import { formatCurrency } from '@/lib/format';

export const metadata: Metadata = {
  title: `Confirmation | ${appConfig.companyName}`,
  description: 'Silver Carz booking payment and confirmation status.',
};

export const dynamic = 'force-dynamic';

/**
 * Post-payment confirmation. Authoritative paid state comes from C7 verification.
 */
export default async function CustomerBookingConfirmationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const nextPath = customerBookingConfirmationPath(bookingId);
  const user = await requireCustomerAuth(nextPath);

  if (user.role !== APP_ROLES.customer) {
    return (
      <>
        <BookingProgressSteps activeStep={6} />
        <CustomerContainer className="max-w-2xl py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
            Customer account required
          </h1>
          <div className="mt-8">
            <Button asChild className="h-11 rounded-md bg-primary font-bold uppercase">
              <Link href={ROUTES.bookings}>Admin bookings</Link>
            </Button>
          </div>
        </CustomerContainer>
      </>
    );
  }

  const result = await getBookingPaymentPageData(bookingId);
  if (!result.success) {
    notFound();
  }

  const { booking, eligibility } = result.data;

  if (eligibility.state === 'already_paid') {
    return (
      <>
        <BookingProgressSteps activeStep={6} />
        <CustomerContainer className="max-w-3xl py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
            Booking confirmed
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base text-muted-foreground">
            Payment received for booking{' '}
            <span className="font-semibold text-foreground">{booking.invoice_number}</span>
            {Number(booking.booking_amount) > 0
              ? ` (${formatCurrency(Number(booking.booking_amount), { maximumFractionDigits: 0 })})`
              : ''}
            . Your car is reserved for the selected dates.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              className="h-11 rounded-md bg-primary font-bold uppercase hover:bg-primary/90"
            >
              <Link href={customerBookingPath(bookingId)}>View booking</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-md">
              <Link href={ROUTES.myBookings}>My bookings</Link>
            </Button>
          </div>
        </CustomerContainer>
      </>
    );
  }

  if (eligibility.canPay || eligibility.state === 'payment_processing') {
    return (
      <>
        <BookingProgressSteps activeStep={6} />
        <CustomerContainer className="max-w-3xl py-10 sm:py-14">
          <PaymentProcessingPanel bookingId={booking.id} invoiceNumber={booking.invoice_number} />
          {eligibility.canPay ? (
            <div className="mt-6">
              <Button asChild variant="outline" className="h-11 rounded-md">
                <Link href={customerBookingPaymentPath(bookingId)}>Return to payment</Link>
              </Button>
            </div>
          ) : null}
        </CustomerContainer>
      </>
    );
  }

  return (
    <>
      <BookingProgressSteps activeStep={eligibility.state === 'payment_expired' ? 6 : 5} />
      <CustomerContainer className="max-w-3xl py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
          {eligibility.title}
        </h1>
        <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
        <p className="mt-5 text-muted-foreground">{eligibility.description}</p>
        <div className="mt-8">
          <Button asChild className="h-11 rounded-md bg-primary font-bold uppercase">
            <Link href={customerBookingPath(bookingId)}>View booking</Link>
          </Button>
        </div>
      </CustomerContainer>
    </>
  );
}
