/**
 * Booking Conflict Detection Engine — centralized overlap business service.
 *
 * Single source of truth for date-window conflicts on a vehicle.
 * Admin booking, customer portal, API, calendar, and reports must call this
 * service — never reimplement overlap rules in React or ad-hoc queries.
 *
 * Operational bookability (maintenance / inactive) remains in the Availability
 * Engine. This service owns schedule conflicts only.
 */

import 'server-only';

import { addDays, parseISO } from 'date-fns';

import { datesOverlap } from '@/features/bookings/lib/date-overlap';
import { todayIsoIst } from '@/lib/dates/ist';
import {
  createBookingConflictError,
  createInvalidBookingDatesError,
} from '@/features/bookings/errors';
import {
  createBookingRepository,
  getBookingRepository,
  type BookingRepository,
} from '@/features/bookings/repository';
import {
  BOOKING_DISPLAY_STATUS_LABELS,
  isScheduleBlockingBooking,
  resolveBookingDisplayStatus,
} from '@/features/bookings/service/status.service';
import { formatDate } from '@/lib/format';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { fromPromise } from '@/services';
import type {
  ApiResponse,
  Booking,
  BookingConflict,
  BookingConflictCheckParams,
  BookingConflictResult,
  BookingStatus,
} from '@/types';
import { BOOKING_STATUSES } from '@/types/enums';

/**
 * Statuses that occupy the vehicle calendar and block overlapping hires.
 * Aligned with Status Service schedule-blocking display states (upcoming / active).
 * Cancelled, draft, and completed never block (completed frees the vehicle).
 */
export const CONFLICT_BLOCKING_STATUSES = [
  BOOKING_STATUSES.confirmed,
  BOOKING_STATUSES.ongoing,
] as const satisfies readonly BookingStatus[];

/** Statuses that never participate in conflict detection. */
export const CONFLICT_IGNORED_STATUSES = [
  BOOKING_STATUSES.cancelled,
  BOOKING_STATUSES.denied,
  BOOKING_STATUSES.draft,
  BOOKING_STATUSES.completed,
] as const satisfies readonly BookingStatus[];

const BLOCKING_STATUS_SET = new Set<string>(CONFLICT_BLOCKING_STATUSES);

export interface ConflictServiceDeps {
  readonly repository?: BookingRepository;
  readonly client?: TypedSupabaseClient;
}

export interface NextAvailableDateParams {
  readonly vehicleId: string;
  /** ISO date — look for availability on or after this day (defaults to today UTC). */
  readonly afterDate?: string;
  readonly excludeBookingId?: string;
}

export interface NextAvailableDateResult {
  /** Earliest suggested delivery date (ISO), or null when unconstrained. */
  readonly nextAvailableDate: string | null;
  /** Latest blocking return date that drove the suggestion, when any. */
  readonly bookedUntil: string | null;
}

export interface ConflictService {
  /**
   * Detect overlapping blocking bookings for a vehicle/date window.
   * Does not check operational availability — call Availability Engine first.
   */
  detectConflicts(params: BookingConflictCheckParams): Promise<ApiResponse<BookingConflictResult>>;
  /**
   * Throws a friendly domain error when any conflict exists.
   * No-op when the target booking status is non-blocking (draft / cancelled).
   */
  assertNoConflict(
    params: BookingConflictCheckParams & { readonly status?: string | null },
  ): Promise<void>;
  /** Whether two inclusive date windows overlap (pure helper). */
  datesOverlap(
    existingDelivery: string,
    existingReturn: string,
    newDelivery: string,
    newReturn: string,
  ): boolean;
  /**
   * Suggested next delivery date after the latest blocking hire ends.
   * Isolated helper for calendars / UX — not required by create/update.
   */
  getNextAvailableDate(
    params: NextAvailableDateParams,
  ): Promise<ApiResponse<NextAvailableDateResult>>;
}

export { datesOverlap } from '@/features/bookings/lib/date-overlap';

export function isConflictBlockingStatus(status: string | null | undefined): boolean {
  return typeof status === 'string' && BLOCKING_STATUS_SET.has(status);
}

function assertValidWindow(deliveryDate: string, returnDate: string): void {
  if (!deliveryDate || !returnDate) {
    throw createInvalidBookingDatesError('Delivery and return dates are required.');
  }

  if (returnDate < deliveryDate) {
    throw createInvalidBookingDatesError();
  }
}

function toConflict(booking: Booking): BookingConflict {
  return {
    bookingId: booking.id,
    invoiceNumber: booking.invoice_number ?? '',
    customerName: booking.customer_name ?? '',
    status: booking.status,
    deliveryDate: booking.delivery_date,
    returnDate: booking.return_date,
  };
}

function buildConflictMessage(conflict: BookingConflict): string {
  const from = formatDate(conflict.deliveryDate);
  const to = formatDate(conflict.returnDate);
  const display = resolveBookingDisplayStatus({
    status: conflict.status,
    delivery_date: conflict.deliveryDate,
    return_date: conflict.returnDate,
  });
  const statusLabel = BOOKING_DISPLAY_STATUS_LABELS[display];
  const details = [
    conflict.invoiceNumber ? `Invoice ${conflict.invoiceNumber}` : null,
    conflict.customerName || null,
    statusLabel || null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  const base = `This vehicle is already booked between ${from} and ${to}.`;
  return details ? `${base} (${details})` : base;
}

function todayIso(): string {
  return todayIsoIst();
}

function addOneDayIso(isoDate: string): string {
  return addDays(parseISO(isoDate), 1).toISOString().slice(0, 10);
}

export function createConflictService(deps: ConflictServiceDeps = {}): ConflictService {
  async function getRepository(): Promise<BookingRepository> {
    if (deps.repository) {
      return deps.repository;
    }

    if (deps.client) {
      return createBookingRepository(deps.client);
    }

    return getBookingRepository();
  }

  const service: ConflictService = {
    datesOverlap,

    detectConflicts(params) {
      return fromPromise(async () => {
        assertValidWindow(params.deliveryDate, params.returnDate);

        const repository = await getRepository();
        const overlaps = await repository.findOverlappingForVehicle({
          vehicleId: params.vehicleId,
          deliveryDate: params.deliveryDate,
          returnDate: params.returnDate,
          excludeBookingId: params.excludeBookingId,
        });

        const conflicts = overlaps.filter((row) => isScheduleBlockingBooking(row)).map(toConflict);

        if (conflicts.length === 0) {
          return {
            hasConflict: false,
            conflicts: [],
          } satisfies BookingConflictResult;
        }

        const primary = conflicts[0]!;

        return {
          hasConflict: true,
          conflicts,
          message: buildConflictMessage(primary),
        } satisfies BookingConflictResult;
      });
    },

    async assertNoConflict(params) {
      if (
        params.status === BOOKING_STATUSES.cancelled ||
        params.status === BOOKING_STATUSES.denied ||
        params.status === BOOKING_STATUSES.draft
      ) {
        return;
      }

      const result = await service.detectConflicts(params);

      if (!result.success) {
        throw result.error;
      }

      if (!result.data.hasConflict || result.data.conflicts.length === 0) {
        return;
      }

      const primary = result.data.conflicts[0]!;
      throw createBookingConflictError(primary, result.data.message);
    },

    getNextAvailableDate(params) {
      return fromPromise(async () => {
        const afterDate = params.afterDate ?? todayIso();
        const repository = await getRepository();

        // Probe a wide forward window so we find the latest return among
        // bookings that still occupy the calendar on/after afterDate.
        const horizon = addDays(parseISO(afterDate), 365 * 2)
          .toISOString()
          .slice(0, 10);

        const overlaps = await repository.findOverlappingForVehicle({
          vehicleId: params.vehicleId,
          deliveryDate: afterDate,
          returnDate: horizon,
          excludeBookingId: params.excludeBookingId,
        });

        const blocking = overlaps.filter((row) => isScheduleBlockingBooking(row));

        if (blocking.length === 0) {
          return {
            nextAvailableDate: afterDate,
            bookedUntil: null,
          } satisfies NextAvailableDateResult;
        }

        let bookedUntil = blocking[0]!.return_date;
        for (const row of blocking) {
          if (row.return_date > bookedUntil) {
            bookedUntil = row.return_date;
          }
        }

        return {
          bookedUntil,
          nextAvailableDate: addOneDayIso(bookedUntil),
        } satisfies NextAvailableDateResult;
      });
    },
  };

  return service;
}

/** Default request-scoped conflict detection engine. */
export function getConflictService(): ConflictService {
  return createConflictService();
}
