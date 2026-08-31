import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BookingProgressSteps } from '@/components/customer/book-a-car/booking-progress-steps';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { appConfig } from '@/config';
import { customerBookingDocumentsPath, customerBookingPath, ROUTES } from '@/constants/routes';
import { BookingDocumentsPanel, listOwnBookingDocuments } from '@/features/booking-documents';
import { getOwnCustomerBookingWithVehicle } from '@/features/customer-booking';
import { APP_ROLES, requireCustomerAuth } from '@/lib/auth';
import { BOOKING_STATUSES } from '@/types/enums';

export const metadata: Metadata = {
  title: `Documents | ${appConfig.companyName}`,
  description: 'Upload documents for your Silver Carz booking request.',
};

export const dynamic = 'force-dynamic';

/**
 * Customer document submission for a booking request (C4).
 */
export default async function CustomerBookingDocumentsPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const nextPath = customerBookingDocumentsPath(bookingId);
  const user = await requireCustomerAuth(nextPath);

  if (user.role !== APP_ROLES.customer) {
    return (
      <>
        <BookingProgressSteps activeStep={4} />
        <CustomerContainer className="max-w-2xl py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
            Customer account required
          </h1>
          <p className="mt-5 text-muted-foreground">
            Staff can review booking documents in the Admin Portal.
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

  const bookingResult = await getOwnCustomerBookingWithVehicle(bookingId);
  if (!bookingResult.success) {
    notFound();
  }

  const booking = bookingResult.data;

  if (booking.status !== BOOKING_STATUSES.draft) {
    redirect(customerBookingPath(bookingId));
  }

  // After submit, status lives on the booking page — don't leave users on upload.
  if (booking.document_submitted) {
    redirect(customerBookingPath(bookingId));
  }

  const documentsResult = await listOwnBookingDocuments(bookingId);
  if (!documentsResult.success) {
    notFound();
  }

  return (
    <>
      <BookingProgressSteps activeStep={4} />
      <CustomerContainer className="max-w-5xl py-8 sm:py-12">
        <BookingDocumentsPanel booking={booking} initialDocuments={documentsResult.data} />
      </CustomerContainer>
    </>
  );
}
