import 'server-only';

import { cookies } from 'next/headers';

import { normalizeCityName } from '@/config/fleet-cities';
import { BOOKING_CITY_COOKIE_MAX_AGE, STORAGE_KEYS } from '@/constants/storage';

export function parseBookingCityCookie(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const city = normalizeCityName(value);
  return city.length > 0 ? city : null;
}

export async function readBookingCity(): Promise<string | null> {
  const store = await cookies();
  return parseBookingCityCookie(store.get(STORAGE_KEYS.bookingCity)?.value);
}

export async function writeBookingCity(city: string): Promise<string> {
  const normalized = normalizeCityName(city);

  if (!normalized) {
    throw new Error('City is required.');
  }

  const store = await cookies();
  store.set(STORAGE_KEYS.bookingCity, normalized, {
    path: '/',
    maxAge: BOOKING_CITY_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  return normalized;
}
