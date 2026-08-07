import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BookingProgressSteps } from '@/components/customer/book-a-car/booking-progress-steps';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { appConfig } from '@/config';
import { customerBookingPaymentPath, ROUTES } from '@/constants/routes';
import { BookingPaymentPanel, getBookingPaymentPageData } from '@/features/payments';
import { APP_ROLES, requireCustomerAuth } from '@/lib/auth';

export const metadata: Metadata = {
  title: `Payment | ${appConfig.companyName}`,
  description: 'Pay for your approved Silver Carz booking.',
};

export const dynamic = 'force-dynamic';

/**
 * Customer booking payment step after admin approval (C6).
 */
export default async function CustomerBookingPaymentPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const nextPath = customerBookingPaymentPath(bookingId);
  const user = await requireCustomerAuth(nextPath);

  if (user.role !== APP_ROLES.customer) {
    return (
      <>
        <BookingProgressSteps activeStep={6} />
        <CustomerContainer className="max-w-2xl py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
            Customer account required
          </h1>
          <p className="mt-5 text-muted-foreground">
            Staff can review booking payments in the Admin Portal.
          </p>
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

  const { booking, eligibility, payments } = result.data;

  return (
    <>
      <BookingProgressSteps activeStep={6} />
      <CustomerContainer className="max-w-3xl py-10 sm:py-14">
        <BookingPaymentPanel booking={booking} eligibility={eligibility} payments={payments} />
      </CustomerContainer>
    </>
  );
}
