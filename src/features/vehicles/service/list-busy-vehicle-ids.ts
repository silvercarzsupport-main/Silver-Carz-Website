/**
 * Resolve vehicle IDs that have schedule-blocking bookings overlapping a window.
 * Used by customer Book a Car date filtering (correct pagination via excludeIds).
 */

import 'server-only';

import { CONFLICT_BLOCKING_STATUSES } from '@/features/bookings/service/conflict.service';
import { getBookingRepository, type BookingRepository } from '@/features/bookings/repository';
import { fromPromise } from '@/services/result';
import type { ApiResponse } from '@/types';

const BLOCKING = new Set<string>(CONFLICT_BLOCKING_STATUSES);

export async function listBusyVehicleIdsForRange(
  params: {
    readonly deliveryDate: string;
    readonly returnDate: string;
  },
  deps?: { readonly repository?: BookingRepository },
): Promise<ApiResponse<readonly string[]>> {
  return fromPromise(async () => {
    const repository = deps?.repository ?? (await getBookingRepository());
    const overlapping = await repository.findOverlappingInRange({
      deliveryDate: params.deliveryDate,
      returnDate: params.returnDate,
      excludeDraft: true,
      includeCancelled: false,
      limit: 1000,
    });

    const busy = new Set<string>();
    for (const booking of overlapping) {
      if (!BLOCKING.has(booking.status)) {
        continue;
      }
      if (booking.vehicle_id) {
        busy.add(booking.vehicle_id);
      }
    }

    return [...busy];
  });
}
