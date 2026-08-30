import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { appConfig } from '@/config';
import { customerBookingPath } from '@/constants/routes';

export const metadata: Metadata = {
  title: `Booking | ${appConfig.companyName}`,
};

export const dynamic = 'force-dynamic';

/**
 * Legacy online-payment URL. Redirects to booking details — no checkout.
 */
export default async function CustomerBookingPaymentRedirectPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  redirect(customerBookingPath(bookingId));
}
