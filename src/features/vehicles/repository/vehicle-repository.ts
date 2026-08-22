/**
 * Vehicle repository — persistence only.
 *
 * No business rules, validation, or authorization. Accepts an injected
 * Supabase client so future DB transactions can share one connection.
 */

import 'server-only';

import { normalizeCityName } from '@/config/fleet-cities';
import {
  createDuplicateVehicleNumberError,
  createVehicleDatabaseFailureError,
  createVehicleNotFoundError,
} from '@/features/vehicles/errors';
import { AppError } from '@/lib/errors';
import { createPaginatedResult, normalizePaginationParams, toOffset } from '@/lib/pagination';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { normalizeSupabaseError } from '@/lib/supabase/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  Vehicle,
  VehicleCreateInput,
  VehicleListFilters,
  VehicleListQuery,
  VehicleSortField,
  VehicleUpdateInput,
} from '@/types/vehicle';
import type { PaginatedResult } from '@/types';
import { FUEL_TYPE_VALUES, isFuelType } from '@/types/enums';

const VEHICLE_SORT_COLUMNS: Record<VehicleSortField, true> = {
  vehicle_name: true,
  vehicle_number: true,
  fuel_type: true,
  created_at: true,
  updated_at: true,
};

const DEFAULT_SORT: VehicleSortField = 'created_at';

export interface VehicleRepository {
  create(input: VehicleCreateInput): Promise<Vehicle>;
  update(id: string, input: VehicleUpdateInput): Promise<Vehicle>;
  /**
   * Patch only `image_path` — used after Storage upload so status fields cannot
   * be rewritten by a broader update payload / schema defaults.
   */
  updateImagePath(id: string, imagePath: string | null): Promise<Vehicle>;
  /** Permanent delete. Prefer `softDelete` for application flows. */
  delete(id: string): Promise<void>;
  softDelete(id: string): Promise<Vehicle>;
  findById(id: string): Promise<Vehicle | null>;
  findByNumber(vehicleNumber: string): Promise<Vehicle | null>;
  list(query?: VehicleListQuery): Promise<PaginatedResult<Vehicle>>;
  search(search: string, query?: VehicleListQuery): Promise<PaginatedResult<Vehicle>>;
  count(filters?: VehicleListFilters): Promise<number>;
  /** Distinct stationed cities (used by the customer location picker). */
  listDistinctCities(filters?: Pick<VehicleListFilters, 'isActive'>): Promise<string[]>;
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function quotedIlike(column: string, pattern: string): string {
  const safe = pattern.replace(/"/g, '');
  return `${column}.ilike."${safe}"`;
}

function mapPersistenceError(error: unknown, vehicleNumber?: string): AppError {
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
    (rawMessage.includes('vehicle_number') || rawMessage.includes('vehicles_vehicle_number'))
  ) {
    return createDuplicateVehicleNumberError(vehicleNumber);
  }

  if (normalized.code === '23505') {
    return createDuplicateVehicleNumberError(vehicleNumber);
  }

  return createVehicleDatabaseFailureError(error);
}

function resolveSort(query?: VehicleListQuery): {
  column: VehicleSortField;
  ascending: boolean;
} {
  const requested = query?.sortBy;
  const column = requested && requested in VEHICLE_SORT_COLUMNS ? requested : DEFAULT_SORT;
  const ascending = (query?.sortOrder ?? 'desc') === 'asc';
  return { column, ascending };
}

function resolveSearchActiveStatus(term: string): boolean | undefined {
  const normalized = term.trim().toLowerCase();

  if (normalized === 'active' || normalized === 'true') {
    return true;
  }

  if (normalized === 'inactive' || normalized === 'false') {
    return false;
  }

  return undefined;
}

function resolveSearchFuelType(term: string): (typeof FUEL_TYPE_VALUES)[number] | undefined {
  const normalized = term.trim().toLowerCase();
  return isFuelType(normalized) ? normalized : undefined;
}

function buildSearchOrFilter(term: string): string {
  const pattern = `%${escapeIlike(term)}%`;
  const clauses = [
    quotedIlike('vehicle_name', pattern),
    quotedIlike('vehicle_number', pattern),
    quotedIlike('city', pattern),
  ];

  const fuelType = resolveSearchFuelType(term);
  if (fuelType) {
    clauses.push(`fuel_type.eq.${fuelType}`);
  }

  const activeStatus = resolveSearchActiveStatus(term);
  if (activeStatus !== undefined) {
    clauses.push(`is_active.eq.${activeStatus}`);
  }

  return clauses.join(',');
}

type FilterableBuilder = {
  eq: (column: string, value: unknown) => FilterableBuilder;
  gte: (column: string, value: unknown) => FilterableBuilder;
  lte: (column: string, value: unknown) => FilterableBuilder;
  ilike: (column: string, value: string) => FilterableBuilder;
  or: (filters: string) => FilterableBuilder;
};

function applyNonSearchFilters(
  builder: FilterableBuilder,
  filters: VehicleListFilters | undefined,
): FilterableBuilder {
  let next = builder;

  if (filters?.fuelType) {
    next = next.eq('fuel_type', filters.fuelType);
  }

  if (filters?.availabilityStatus) {
    next = next.eq('availability_status', filters.availabilityStatus);
  }

  if (filters?.isActive !== undefined) {
    next = next.eq('is_active', filters.isActive);
  } else if (filters?.available === true) {
    // Active roster + available status. Booking-window conflicts come later.
    next = next.eq('is_active', true).eq('availability_status', 'available');
  } else if (!filters?.includeInactive) {
    next = next.eq('is_active', true);
  }

  if (filters?.minDailyRate !== undefined && Number.isFinite(filters.minDailyRate)) {
    next = next.gte('default_daily_rate', filters.minDailyRate);
  }

  if (filters?.maxDailyRate !== undefined && Number.isFinite(filters.maxDailyRate)) {
    next = next.lte('default_daily_rate', filters.maxDailyRate);
  }

  const city = filters?.city ? normalizeCityName(filters.city) : '';
  if (city) {
    next = next.ilike('city', escapeIlike(city));
  }

  if (filters?.createdFrom) {
    next = next.gte('created_at', filters.createdFrom);
  }

  if (filters?.createdTo) {
    next = next.lte('created_at', `${filters.createdTo}T23:59:59.999Z`);
  }

  return next;
}

export function createVehicleRepository(client: TypedSupabaseClient): VehicleRepository {
  const repository: VehicleRepository = {
    async create(input) {
      const { data, error } = await client.from('vehicles').insert(input).select('*').single();

      if (error) {
        throw mapPersistenceError(error, input.vehicle_number);
      }

      return data;
    },

    async update(id, input) {
      const { data, error } = await client
        .from('vehicles')
        .update(input)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        throw mapPersistenceError(error, input.vehicle_number);
      }

      if (!data) {
        throw createVehicleNotFoundError();
      }

      return data;
    },

    async updateImagePath(id, imagePath) {
      return repository.update(id, { image_path: imagePath });
    },

    async delete(id) {
      const existing = await repository.findById(id);

      if (!existing) {
        throw createVehicleNotFoundError();
      }

      const { error } = await client.from('vehicles').delete().eq('id', id);

      if (error) {
        throw mapPersistenceError(error);
      }
    },

    async softDelete(id) {
      return repository.update(id, {
        is_active: false,
        availability_status: 'inactive',
      });
    },

    async findById(id) {
      const { data, error } = await client.from('vehicles').select('*').eq('id', id).maybeSingle();

      if (error) {
        throw mapPersistenceError(error);
      }

      return data;
    },

    async findByNumber(vehicleNumber) {
      const { data, error } = await client
        .from('vehicles')
        .select('*')
        .eq('vehicle_number', vehicleNumber)
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

      let builder = client.from('vehicles').select('*', { count: 'exact' });
      builder = applyNonSearchFilters(
        builder as unknown as FilterableBuilder,
        query,
      ) as typeof builder;

      if (searchTerm) {
        builder = builder.or(buildSearchOrFilter(searchTerm));
      }

      const { data, error, count } = await builder
        .order(column, { ascending })
        .range(offset, offset + pagination.pageSize - 1);

      if (error) {
        throw mapPersistenceError(error);
      }

      return createPaginatedResult(data ?? [], pagination, count ?? 0);
    },

    async search(search, query = {}) {
      return repository.list({ ...query, search });
    },

    async count(filters = {}) {
      let builder = client.from('vehicles').select('id', { count: 'exact', head: true });
      builder = applyNonSearchFilters(
        builder as unknown as FilterableBuilder,
        filters,
      ) as typeof builder;

      const searchTerm = filters.search?.trim();

      if (searchTerm) {
        builder = builder.or(buildSearchOrFilter(searchTerm));
      }

      const { error, count } = await builder;

      if (error) {
        throw mapPersistenceError(error);
      }

      return count ?? 0;
    },

    async listDistinctCities(filters = {}) {
      let builder = client.from('vehicles').select('city');

      if (filters.isActive !== undefined) {
        builder = builder.eq('is_active', filters.isActive);
      } else {
        builder = builder.eq('is_active', true);
      }

      const { data, error } = await builder;

      if (error) {
        throw mapPersistenceError(error);
      }

      const seen = new Set<string>();
      const cities: string[] = [];

      for (const row of data ?? []) {
        const city = normalizeCityName(row.city);
        if (!city || seen.has(city)) {
          continue;
        }
        seen.add(city);
        cities.push(city);
      }

      return cities.sort((left, right) => left.localeCompare(right, 'en-IN'));
    },
  };

  return repository;
}

/** Convenience factory using the request-scoped server client. */
export async function getVehicleRepository(): Promise<VehicleRepository> {
  const client = await createSupabaseServerClient();
  return createVehicleRepository(client);
}
