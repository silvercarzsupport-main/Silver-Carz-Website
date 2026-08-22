/**
 * Payment hold for approved customer requests.
 *
 * Admin approval reserves the car. The customer must pay within this window
 * or the hold is released back to the calendar.
 */

/** How long an approved unpaid request holds the vehicle. */
export const PAYMENT_HOLD_HOURS = 24;

/** Minimum hold when pickup is imminent. */
export const PAYMENT_HOLD_MINIMUM_HOURS = 2;

/** Pickup-day cutoff in IST (06:00) — pay before the car is due out. */
const PICKUP_CUTOFF_IST_OFFSET = '+05:30';
const PICKUP_CUTOFF_HOUR = '06:00:00';

export function computePaymentDueAt(deliveryDate: string, approvedAt: Date = new Date()): string {
  const holdUntil = new Date(approvedAt.getTime() + PAYMENT_HOLD_HOURS * 60 * 60 * 1000);
  const pickupCutoff = new Date(`${deliveryDate}T${PICKUP_CUTOFF_HOUR}${PICKUP_CUTOFF_IST_OFFSET}`);

  let due = holdUntil;
  if (!Number.isNaN(pickupCutoff.getTime()) && pickupCutoff < due) {
    due = pickupCutoff;
  }

  const minimum = new Date(approvedAt.getTime() + PAYMENT_HOLD_MINIMUM_HOURS * 60 * 60 * 1000);
  if (due <= approvedAt) {
    due = minimum;
  }

  return due.toISOString();
}

export function isPaymentWindowOpen(
  paymentDueAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!paymentDueAt) {
    return true;
  }

  const due = Date.parse(paymentDueAt);
  if (Number.isNaN(due)) {
    return true;
  }

  return due >= now.getTime();
}
