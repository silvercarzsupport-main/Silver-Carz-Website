/**
 * Silver Carz operates in India. Booking dates are calendar dates in
 * Asia/Kolkata — never the browser or server local timezone.
 */

export const BOOKING_TIME_ZONE = 'Asia/Kolkata';

/** Today's calendar date in IST (`YYYY-MM-DD`). */
export function todayIsoIst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** UTC noon for an ISO date so month/day math does not shift across timezones. */
export function isoToUtcNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

export function startOfMonthIso(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function endOfMonthIso(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${isoDate.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
}

export function addMonthsToMonthStart(monthStartIso: string, amount: number): string {
  const year = Number(monthStartIso.slice(0, 4));
  const month = Number(monthStartIso.slice(5, 7));
  return new Date(Date.UTC(year, month - 1 + amount, 1)).toISOString().slice(0, 10);
}

export function formatIsoMonthTitle(monthStartIso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(isoToUtcNoon(startOfMonthIso(monthStartIso)));
}
