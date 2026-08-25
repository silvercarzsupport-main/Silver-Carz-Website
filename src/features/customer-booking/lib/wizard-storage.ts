/**
 * Session-scoped draft for the customer booking wizard (browser only).
 * Preserves dates/details across soft navigations within the same tab.
 *
 * Do not put Server Component helpers here — this file is imported by a
 * `'use client'` wizard and would poison server imports of co-located exports.
 */

import type { RentalMode } from '@/types';

import type { BookingWizardStep } from '@/features/customer-booking/lib/wizard-step';

export type { BookingWizardStep };

export type BookingWizardDraft = {
  readonly deliveryDate: string;
  readonly returnDate: string;
  readonly mode: RentalMode;
  readonly customerName: string;
  readonly contactNumber: string;
  readonly address: string;
  readonly city: string;
  readonly state: string;
  readonly zipCode: string;
  readonly placeToVisit: string;
  readonly whatsappUpdates: boolean;
};

const STORAGE_PREFIX = 'sc-booking-request:';

function storageKey(vehicleId: string): string {
  return `${STORAGE_PREFIX}${vehicleId}`;
}

export function readBookingWizardDraft(vehicleId: string): Partial<BookingWizardDraft> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(vehicleId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Partial<BookingWizardDraft>;
  } catch {
    return null;
  }
}

export function writeBookingWizardDraft(
  vehicleId: string,
  draft: Partial<BookingWizardDraft>,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const existing = readBookingWizardDraft(vehicleId) ?? {};
    window.sessionStorage.setItem(storageKey(vehicleId), JSON.stringify({ ...existing, ...draft }));
  } catch {
    // Ignore quota / private-mode failures — form still works in memory.
  }
}

export function clearBookingWizardDraft(vehicleId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey(vehicleId));
  } catch {
    // no-op
  }
}
