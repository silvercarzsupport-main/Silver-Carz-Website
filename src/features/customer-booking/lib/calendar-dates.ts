/**
 * Pure date helpers for the customer availability calendar.
 * All calendar days are IST business dates.
 */

import {
  addMonthsToMonthStart,
  endOfMonthIso,
  formatIsoMonthTitle,
  isoToUtcNoon,
  startOfMonthIso,
  todayIsoIst,
} from '@/lib/dates/ist';

export {
  addMonthsToMonthStart,
  endOfMonthIso,
  formatIsoMonthTitle,
  isoToUtcNoon,
  startOfMonthIso,
  todayIsoIst,
};

/** @deprecated Use `todayIsoIst` — booking dates are IST, not the device timezone. */
export const todayIsoLocal = todayIsoIst;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthKeyFromIso(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Current calendar month (IST) and the single allowed next month. */
export function getAllowedCalendarMonths(asOfIso: string = todayIsoIst()): {
  readonly currentMonth: string;
  readonly nextMonth: string;
} {
  const currentMonth = startOfMonthIso(asOfIso);
  return {
    currentMonth,
    nextMonth: addMonthsToMonthStart(currentMonth, 1),
  };
}

/** Last bookable day: end of next IST calendar month. */
export function getBookingHorizonEndIso(asOfIso: string = todayIsoIst()): string {
  return endOfMonthIso(getAllowedCalendarMonths(asOfIso).nextMonth);
}

export function expandInclusiveDateRange(deliveryDate: string, returnDate: string): string[] {
  if (!deliveryDate || !returnDate || returnDate < deliveryDate) {
    return [];
  }

  const days: string[] = [];
  let cursor = deliveryDate;

  while (cursor <= returnDate) {
    days.push(cursor);
    const next = isoToUtcNoon(cursor);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }

  return days;
}

export function rangeContainsBookedDate(
  deliveryDate: string,
  returnDate: string,
  bookedDates: ReadonlySet<string>,
): boolean {
  return expandInclusiveDateRange(deliveryDate, returnDate).some((day) => bookedDates.has(day));
}

export function buildMonthCells(monthStartIso: string): Array<{
  readonly isoDate: string | null;
  readonly dayNumber: number | null;
}> {
  const startIso = startOfMonthIso(monthStartIso);
  const endIso = endOfMonthIso(startIso);
  const start = isoToUtcNoon(startIso);
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  const leading: Array<{ isoDate: string | null; dayNumber: number | null }> = Array.from(
    { length: mondayOffset },
    () => ({ isoDate: null, dayNumber: null }),
  );

  const body: Array<{ isoDate: string; dayNumber: number }> = [];
  for (const isoDate of expandInclusiveDateRange(startIso, endIso)) {
    body.push({
      isoDate,
      dayNumber: isoToUtcNoon(isoDate).getUTCDate(),
    });
  }

  return [...leading, ...body];
}

export function isPastDate(isoDate: string, todayIso: string = todayIsoIst()): boolean {
  return isoDate < todayIso;
}

export function isWithinBookingHorizon(isoDate: string, asOfIso: string = todayIsoIst()): boolean {
  return isoDate >= asOfIso && isoDate <= getBookingHorizonEndIso(asOfIso);
}

export function addDaysIso(isoDate: string, amount: number): string {
  const next = isoToUtcNoon(isoDate);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}
