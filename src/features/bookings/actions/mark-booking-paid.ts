'use server';

/**
 * Record offline payment collected at vehicle pickup (admin only).
 */

import { revalidatePath } from 'next/cache';

import { customerBookingPath, bookingDetailPath, ROUTES } from '@/constants/routes';
import { getBookingService } from '@/features/bookings/service';
import type { ApiResponse, Booking, PaymentMethod } from '@/types';

export async function markBookingPaid(
  id: string,
  input: {
    readonly paymentMethod: PaymentMethod;
    readonly paymentReference?: string | null;
    readonly submittedAmount?: number | null;
  },
): Promise<ApiResponse<Booking>> {
  const result = await getBookingService().markBookingPaid(id, input);

  if (result.success) {
    revalidatePath(bookingDetailPath(id));
    revalidatePath(ROUTES.bookings);
    revalidatePath(customerBookingPath(id));
    revalidatePath(ROUTES.myBookings);
  }

  return result;
}
