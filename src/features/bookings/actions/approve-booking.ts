'use server';

/**
 * Approve a draft customer booking request (draft → confirmed/ongoing/completed).
 * Approval reserves the vehicle. Payment is collected at pickup, not online.
 */

import { getBookingService } from '@/features/bookings/service';
import type { ApiResponse, Booking } from '@/types';

export async function approveBooking(id: string): Promise<ApiResponse<Booking>> {
  return getBookingService().approveBooking(id);
}
