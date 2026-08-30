/**
 * Booking repository — persistence only.
 *
 * No business rules, validation, or authorization. Accepts an injected
 * Supabase client so future DB transactions can share one connection.
 */

import 'server-only';

import {
  createBookingDatabaseFailureError,
  createBookingNotFoundError,
  createDuplicateInvoiceError,
  createVehicleUnavailableError,
} from '@/features/bookings/errors';
import { AppError } from '@/lib/errors';
import { createPaginatedResult, normalizePaginationParams, toOffset } from '@/lib/pagination';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { normalizeSupabaseError } from '@/lib/supabase/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  Booking,
  BookingCreateInput,
  BookingFleetOverlapQuery,
  BookingListFilters,
  BookingListQuery,
  BookingSortField,
  BookingUpdateInput,
  BookingVehicleOverlapQuery,
  BookingWithVehicle,
} from '@/types/booking';
import type { PaginatedResult } from '@/types';
import { BOOKING_STATUSES } from '@/types/enums';

const BOOKING_SORT_COLUMNS: Record<BookingSortField, true> = {
  invoice_date: true,
  delivery_date: true,
  return_date: true,
  created_at: true,
  customer_name: true,
  invoice_number: true,
};

const DEFAULT_SORT: BookingSortField = 'created_at';

export interface BookingRepository {
  create(input: BookingCreateInput): Promise<Booking>;
  update(id: string, input: BookingUpdateInput): Promise<Booking>;
  /**
   * Conditional update for draft → approved/denied transitions.
   * Returns null when the row is missing or no longer in `expectedStatus`
   * (concurrent admin action / already processed).
   */
  updateIfStatus(
    id: string,
    expectedStatus: Booking['status'],
    input: BookingUpdateInput,
  ): Promise<Booking | null>;
  /**
   * Conditional update for unpaid → paid collection.
   * Returns null when the row is missing, not collectible, or already paid.
   */
  updateIfUnpaid(id: string, input: BookingUpdateInput): Promise<Booking | null>;
  /** Permanent delete. Prefer `softDelete` for application flows. */
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  findByIdWithVehicle(id: string): Promise<BookingWithVehicle | null>;
  findByInvoiceNumber(invoiceNumber: string): Promise<Booking | null>;
  list(query?: BookingListQuery): Promise<PaginatedResult<BookingWithVehicle>>;
  search(search: string, query?: BookingListQuery): Promise<PaginatedResult<BookingWithVehicle>>;
  count(filters?: BookingListFilters): Promise<number>;
  /**
   * Returns non-cancelled, non-draft bookings that can drive availability state
   * (confirmed / ongoing / completed history for date windows).
   * Used by the Availability Engine — not for UI lists.
   */
  findLifecycleBookingsForVehicle(vehicleId: string): Promise<Booking[]>;
  /**
   * Lifecycle bookings for many vehicles in one query (Availability Engine batch sync).
   * When `vehicleIds` is empty, returns an empty array without hitting the database.
   */
  findLifecycleBookingsForVehicles(vehicleIds: readonly string[]): Promise<Booking[]>;
  /**
   * Returns blocking bookings for a vehicle that overlap a date range.
   * Only confirmed / ongoing rows — used by the Conflict Detection Engine.
   * Overlap: delivery_date <= returnDate AND return_date >= deliveryDate.
   */
  findOverlappingForVehicle(params: BookingVehicleOverlapQuery): Promise<Booking[]>;
  /**
   * Fleet-wide bookings overlapping a calendar viewport (with vehicle join).
   * Closed-interval overlap — used by the Fleet Availability Calendar.
   * Does not invent availability; callers compose Status / Availability engines.
   */
  findOverlappingInRange(params: BookingFleetOverlapQuery): Promise<BookingWithVehicle[]>;
}

/** Columns needed for list / calendar / dashboard booking cards. */
const BOOKING_VEHICLE_EMBED =
  '*, vehicle:vehicles(id, vehicle_name, vehicle_number, image_path, availability_status, is_active, fuel_type, default_daily_rate)';

/** Columns needed to resolve display lifecycle status. */
const LIFECYCLE_BOOKING_COLUMNS = 'id, vehicle_id, status, delivery_date, return_date';

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function quotedIlike(column: string, pattern: string): string {
  const safe = pattern.replace(/"/g, '');
  return `${column}.ilike."${safe}"`;
}

function mapPersistenceError(error: unknown, invoiceNumber?: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const normalized = normalizeSupabaseError(error);
  const rawMessage =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
      ? (error as { message: string }).message.toLowerCase()
      : '';

  if (
    normalized.code === '23505' &&
    (rawMessage.includes('invoice_number') || rawMessage.includes('bookings_invoice'))
  ) {
    return createDuplicateInvoiceError(invoiceNumber);
  }

  if (
    normalized.code === '23P01' ||
    rawMessage.includes('no_overlapping_active_hires') ||
    rawMessage.includes('exclusion')
  ) {
    return createVehicleUnavailableError('This vehicle is already booked for the requested dates.');
  }

  if (normalized.code === '23505') {
    return createDuplicateInvoiceError(invoiceNumber);
  }

  return createBookingDatabaseFailureError(error);
}

function resolveSort(query?: BookingListQuery): {
  column: BookingSortField;
  ascending: boolean;
} {
  const requested = query?.sortBy;
  const column = requested && requested in BOOKING_SORT_COLUMNS ? requested : DEFAULT_SORT;
  const ascending = (query?.sortOrder ?? 'desc') === 'asc';
  return { column, ascending };
}

async function resolveVehicleIdsByNumber(
  client: TypedSupabaseClient,
  search: string,
): Promise<string[]> {
  const pattern = `%${escapeIlike(search.trim())}%`;
  const { data, error } = await client
    .from('vehicles')
    .select('id')
    .ilike('vehicle_number', pattern)
    .limit(50);

  if (error) {
    throw mapPersistenceError(error);
  }

  return (data ?? []).map((row) => row.id);
}

function buildSearchOrFilter(term: string, vehicleIds: readonly string[]): string {
  const pattern = `%${escapeIlike(term)}%`;
  const clauses = [
    quotedIlike('invoice_number', pattern),
    quotedIlike('customer_name', pattern),
    quotedIlike('contact_number', pattern),
    quotedIlike('place_to_visit', pattern),
  ];

  if (vehicleIds.length > 0) {
    clauses.push(`vehicle_id.in.(${vehicleIds.join(',')})`);
  }

  return clauses.join(',');
}

type FilterableBuilder = {
  eq: (column: string, value: unknown) => FilterableBuilder;
  neq: (column: string, value: unknown) => FilterableBuilder;
  gt: (column: string, value: unknown) => FilterableBuilder;
  gte: (column: string, value: unknown) => FilterableBuilder;
  lt: (column: string, value: unknown) => FilterableBuilder;
  lte: (column: string, value: unknown) => FilterableBuilder;
  or: (filters: string) => FilterableBuilder;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Apply Status Engine display-status filters (date-derived lifecycle + terminals).
 * Mirrors `resolveBookingDisplayStatus` rules for list queries.
 */
function applyStatusFilter(builder: FilterableBuilder, status: string): FilterableBuilder {
  const today = todayIsoDate();

  switch (status) {
    case 'cancelled':
      return builder.eq('status', BOOKING_STATUSES.cancelled);
    case 'denied':
      return builder.eq('status', BOOKING_STATUSES.denied);
    case 'draft':
      return builder.eq('status', BOOKING_STATUSES.draft);
    case 'upcoming':
      return builder
        .neq('status', BOOKING_STATUSES.cancelled)
        .neq('status', BOOKING_STATUSES.denied)
        .neq('status', BOOKING_STATUSES.draft)
        .gt('delivery_date', today);
    case 'active':
      return builder
        .neq('status', BOOKING_STATUSES.cancelled)
        .neq('status', BOOKING_STATUSES.denied)
        .neq('status', BOOKING_STATUSES.draft)
        .lte('delivery_date', today)
        .gte('return_date', today);
    case 'completed':
      return builder
        .neq('status', BOOKING_STATUSES.cancelled)
        .neq('status', BOOKING_STATUSES.denied)
        .neq('status', BOOKING_STATUSES.draft)
        .lt('return_date', today);
    // Legacy persisted-enum filters (still accepted for older URLs / callers)
    case BOOKING_STATUSES.confirmed:
    case BOOKING_STATUSES.ongoing:
    case BOOKING_STATUSES.completed:
      return builder.eq('status', status);
    default:
      return builder.eq('status', status);
  }
}

function applyNonSearchFilters(
  builder: FilterableBuilder,
  filters: BookingListFilters | undefined,
): FilterableBuilder {
  let next = builder;

  if (filters?.status) {
    next = applyStatusFilter(next, filters.status);
  } else {
    if (!filters?.includeCancelled) {
      next = next.neq('status', BOOKING_STATUSES.cancelled).neq('status', BOOKING_STATUSES.denied);
    }
    if (filters?.excludeDraft) {
      next = next.neq('status', BOOKING_STATUSES.draft);
    }
  }

  if (filters?.vehicleId) {
    next = next.eq('vehicle_id', filters.vehicleId);
  }

  if (filters?.mode) {
    next = next.eq('mode', filters.mode);
  }

  if (filters?.paymentMethod) {
    next = next.eq('payment_method', filters.paymentMethod);
  }

  if (filters?.deliveryDateFrom) {
    next = next.gte('delivery_date', filters.deliveryDateFrom);
  }

  if (filters?.deliveryDateTo) {
    next = next.lte('delivery_date', filters.deliveryDateTo);
  }

  if (filters?.returnDateFrom) {
    next = next.gte('return_date', filters.returnDateFrom);
  }

  if (filters?.returnDateTo) {
    next = next.lte('return_date', filters.returnDateTo);
  }

  return next;
}

export function createBookingRepository(client: TypedSupabaseClient): BookingRepository {
  const repository: BookingRepository = {
    async create(input) {
      const { data, error } = await client.from('bookings').insert(input).select('*').single();

      if (error) {
        throw mapPersistenceError(error, input.invoice_number);
      }

      return data;
    },

    async update(id, input) {
      const { data, error } = await client
        .from('bookings')
        .update(input)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        throw mapPersistenceError(error, input.invoice_number);
      }

      if (!data) {
        throw createBookingNotFoundError();
      }

      return data;
    },

    async updateIfStatus(id, expectedStatus, input) {
      const { data, error } = await client
        .from('bookings')
        .update(input)
        .eq('id', id)
        .eq('status', expectedStatus)
        .select('*')
        .maybeSingle();

      if (error) {
        throw mapPersistenceError(error, input.invoice_number);
      }

      return data;
    },

    async updateIfUnpaid(id, input) {
      const { data, error } = await client
        .from('bookings')
        .update(input)
        .eq('id', id)
        .eq('payment_status', 'unpaid')
        .in('status', [
          BOOKING_STATUSES.confirmed,
          BOOKING_STATUSES.ongoing,
          BOOKING_STATUSES.completed,
        ])
        .select('*')
        .maybeSingle();

      if (error) {
        throw mapPersistenceError(error, input.invoice_number);
      }

      return data;
    },

    async delete(id) {
      const existing = await repository.findById(id);

      if (!existing) {
        throw createBookingNotFoundError();
      }

      const { error } = await client.from('bookings').delete().eq('id', id);

      if (error) {
        throw mapPersistenceError(error);
      }
    },

    async softDelete(id) {
      return repository.update(id, { status: BOOKING_STATUSES.cancelled });
    },

    async findById(id) {
      const { data, error } = await client.from('bookings').select('*').eq('id', id).maybeSingle();

      if (error) {
        throw mapPersistenceError(error);
      }

      return data;
    },

    async findByIdWithVehicle(id) {
      const { data, error } = await client
        .from('bookings')
        .select('*, vehicle:vehicles(*)')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw mapPersistenceError(error);
      }

      if (!data?.vehicle) {
        return null;
      }

      return data as BookingWithVehicle;
    },

    async findByInvoiceNumber(invoiceNumber) {
      const { data, error } = await client
        .from('bookings')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .maybeSingle();

      if (error) {
        throw mapPersistenceError(error);
      }

      return data;
    },

    async list(query = {}) {
      const pagination = normalizePaginationParams(query);
      const offset = toOffset(pagination);
      const { column, ascending } = resolveSort(query);
      const searchTerm = query.search?.trim();

      let vehicleIds: string[] = [];

      if (searchTerm) {
        vehicleIds = await resolveVehicleIdsByNumber(client, searchTerm);
      }

      let builder = client.from('bookings').select(BOOKING_VEHICLE_EMBED, { count: 'exact' });
      builder = applyNonSearchFilters(
        builder as unknown as FilterableBuilder,
        query,
      ) as typeof builder;

      if (searchTerm) {
        builder = builder.or(buildSearchOrFilter(searchTerm, vehicleIds));
      }

      const { data, error, count } = await builder
        .order(column, { ascending })
        .range(offset, offset + pagination.pageSize - 1);

      if (error) {
        throw mapPersistenceError(error);
      }

      const rows = (data ?? []).filter((row): row is BookingWithVehicle => row.vehicle != null);

      return createPaginatedResult(rows, pagination, count ?? 0);
    },

    async search(search, query = {}) {
      return repository.list({ ...query, search });
    },

    async count(filters = {}) {
      let builder = client.from('bookings').select('id', { count: 'exact', head: true });
      builder = applyNonSearchFilters(
        builder as unknown as FilterableBuilder,
        filters,
      ) as typeof builder;

      const searchTerm = filters.search?.trim();

      if (searchTerm) {
        const vehicleIds = await resolveVehicleIdsByNumber(client, searchTerm);
        builder = builder.or(buildSearchOrFilter(searchTerm, vehicleIds));
      }

      const { error, count } = await builder;

      if (error) {
        throw mapPersistenceError(error);
      }

      return count ?? 0;
    },

    async findLifecycleBookingsForVehicle(vehicleId) {
      const { data, error } = await client
        .from('bookings')
        .select(LIFECYCLE_BOOKING_COLUMNS)
        .eq('vehicle_id', vehicleId)
        .in('status', [
          BOOKING_STATUSES.confirmed,
          BOOKING_STATUSES.ongoing,
          BOOKING_STATUSES.completed,
        ])
        .order('delivery_date', { ascending: true });

      if (error) {
        throw mapPersistenceError(error);
      }

      return (data ?? []) as Booking[];
    },

    async findLifecycleBookingsForVehicles(vehicleIds) {
      if (vehicleIds.length === 0) {
        return [];
      }

      const { data, error } = await client
        .from('bookings')
        .select(LIFECYCLE_BOOKING_COLUMNS)
        .in('vehicle_id', [...vehicleIds])
        .in('status', [
          BOOKING_STATUSES.confirmed,
          BOOKING_STATUSES.ongoing,
          BOOKING_STATUSES.completed,
        ])
        .order('delivery_date', { ascending: true });

      if (error) {
        throw mapPersistenceError(error);
      }

      return (data ?? []) as Booking[];
    },

    async findOverlappingForVehicle(params) {
      // SECURITY DEFINER RPC — works for staff and customer JWTs (C3).
      // Closed-interval overlap + confirmed/ongoing only.
      const { data, error } = await client.rpc('list_vehicle_booking_conflicts', {
        p_vehicle_id: params.vehicleId,
        p_delivery_date: params.deliveryDate,
        p_return_date: params.returnDate,
        p_exclude_booking_id: params.excludeBookingId ?? null,
      });

      if (error) {
        throw mapPersistenceError(error);
      }

      return (data ?? []) as Booking[];
    },

    async findOverlappingInRange(params) {
      const limit = Math.min(Math.max(params.limit ?? 500, 1), 1000);
      const excludeDraft = params.excludeDraft !== false;

      let builder = client
        .from('bookings')
        .select(BOOKING_VEHICLE_EMBED)
        .lte('delivery_date', params.returnDate)
        .gte('return_date', params.deliveryDate)
        .order('delivery_date', { ascending: true })
        .limit(limit);

      if (!params.includeCancelled) {
        builder = builder
          .neq('status', BOOKING_STATUSES.cancelled)
          .neq('status', BOOKING_STATUSES.denied);
      }

      if (excludeDraft) {
        builder = builder.neq('status', BOOKING_STATUSES.draft);
      }

      if (params.vehicleId) {
        builder = builder.eq('vehicle_id', params.vehicleId);
      } else if (params.vehicleIds && params.vehicleIds.length > 0) {
        builder = builder.in('vehicle_id', [...params.vehicleIds]);
      } else if (params.vehicleIds && params.vehicleIds.length === 0) {
        return [];
      }

      if (params.excludeBookingId) {
        builder = builder.neq('id', params.excludeBookingId);
      }

      const driverTerm = params.driverName?.trim();
      if (driverTerm) {
        const pattern = `%${escapeIlike(driverTerm)}%`;
        builder = builder.ilike('driver_name', pattern);
      }

      const searchTerm = params.search?.trim();
      if (searchTerm) {
        const vehicleIds = await resolveVehicleIdsByNumber(client, searchTerm);
        builder = builder.or(buildSearchOrFilter(searchTerm, vehicleIds));
      }

      const { data, error } = await builder;

      if (error) {
        throw mapPersistenceError(error);
      }

      return (data ?? []).filter((row): row is BookingWithVehicle => row.vehicle != null);
    },
  };

  return repository;
}

/** Convenience factory using the request-scoped server client. */
export async function getBookingRepository(): Promise<BookingRepository> {
  const client = await createSupabaseServerClient();
  return createBookingRepository(client);
}
