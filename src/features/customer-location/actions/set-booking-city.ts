'use server';

import { revalidatePath } from 'next/cache';

import { resolveIndianCity } from '@/config/indian-cities';
import { writeBookingCity } from '@/features/customer-location/lib/booking-city-cookie';
import { AppError } from '@/lib/errors';
import { fail, ok } from '@/services/result';
import type { ApiResponse } from '@/types';

export async function setBookingCity(city: string): Promise<ApiResponse<{ city: string }>> {
  try {
    const normalized = resolveIndianCity(city);

    if (!normalized) {
      return fail('Choose a valid city in India.');
    }

    const saved = await writeBookingCity(normalized);
    revalidatePath('/');
    revalidatePath('/booking/continue');
    return ok({ city: saved });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error);
    }

    return fail('Could not save your city. Please try again.');
  }
}
