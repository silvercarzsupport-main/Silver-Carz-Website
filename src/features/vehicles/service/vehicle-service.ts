/**
 * Vehicle service — business rules, authorization, and repository orchestration.
 *
 * Server Actions and future API routes call this layer only.
 * Never import the repository from UI code.
 */

import 'server-only';

import { DEFAULT_FLEET_CITY, normalizeCityName } from '@/config/fleet-cities';
import {
  createDuplicateVehicleNumberError,
  createInactiveVehicleError,
  createUnauthorizedVehicleAccessError,
  createVehicleNotFoundError,
  createVehicleValidationError,
} from '@/features/vehicles/errors';
import {
  createVehicleRepository,
  getVehicleRepository,
  type VehicleRepository,
} from '@/features/vehicles/repository';
import {
  createAvailabilityService,
  getAvailabilityService,
  type AvailabilityService,
} from '@/features/vehicles/service/availability.service';
import { PERMISSIONS, requirePermission } from '@/lib/auth';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { fromPromise } from '@/services';
import type {
  PaginatedResult,
  Vehicle,
  VehicleAvailabilityQuery,
  VehicleCreateInput,
  VehicleListFilters,
  VehicleListQuery,
  VehicleUpdateInput,
} from '@/types';
import type { ApiResponse } from '@/types';
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleListFiltersSchema,
  vehicleListQuerySchema,
  type CreateVehicleValues,
  type UpdateVehicleValues,
} from '@/validations';
import { VEHICLE_AVAILABILITY_STATUSES } from '@/types/enums';

export interface VehicleServiceDeps {
  readonly repository?: VehicleRepository;
  readonly client?: TypedSupabaseClient;
  readonly availabilityService?: AvailabilityService;
  /** Optional override for tests; defaults to `requirePermission`. */
  readonly requirePermission?: typeof requirePermission;
}

export interface VehicleService {
  createVehicle(input: unknown): Promise<ApiResponse<Vehicle>>;
  updateVehicle(id: string, input: unknown): Promise<ApiResponse<Vehicle>>;
  /**
   * Persist Storage object path only — never runs the full update Zod schema
   * (avoids accidental status field rewrites).
   */
  setVehicleImagePath(id: string, imagePath: string | null): Promise<ApiResponse<Vehicle>>;
  /** Soft-delete (`is_active → false`). Preferred application delete. */
  deleteVehicle(id: string): Promise<ApiResponse<Vehicle>>;
  /** Permanent delete — reserved for trusted admin flows. */
  permanentlyDeleteVehicle(id: string): Promise<ApiResponse<null>>;
  getVehicle(id: string): Promise<ApiResponse<Vehicle>>;
  getVehicleByNumber(vehicleNumber: string): Promise<ApiResponse<Vehicle>>;
  listVehicles(query?: VehicleListQuery): Promise<ApiResponse<PaginatedResult<Vehicle>>>;
  searchVehicles(
    search: string,
    query?: VehicleListQuery,
  ): Promise<ApiResponse<PaginatedResult<Vehicle>>>;
  countVehicles(filters?: VehicleListFilters): Promise<ApiResponse<number>>;
  /**
   * Architecture-ready availability helper.
   * Today: active vehicles only. Future: booking conflict window.
   */
  isVehicleAvailable(query: VehicleAvailabilityQuery): Promise<ApiResponse<boolean>>;
  /**
   * Ensures a vehicle exists and is active — for future booking / hire flows.
   */
  requireActiveVehicle(id: string): Promise<ApiResponse<Vehicle>>;
}

function parseCreateInput(input: unknown): CreateVehicleValues {
  const parsed = createVehicleSchema.safeParse(input);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw createVehicleValidationError(first?.message ?? 'Invalid vehicle details.');
  }

  return parsed.data;
}

function parseUpdateInput(input: unknown): UpdateVehicleValues {
  const parsed = updateVehicleSchema.safeParse(input);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw createVehicleValidationError(first?.message ?? 'Invalid vehicle details.');
  }

  return parsed.data;
}

function normalizeVehicleNumber(vehicleNumber: string): string {
  return vehicleNumber.replace(/\s+/g, '').toUpperCase();
}

async function ensureVehicleNumberUnique(
  repository: VehicleRepository,
  vehicleNumber: string,
  excludeVehicleId?: string,
): Promise<void> {
  const existing = await repository.findByNumber(vehicleNumber);

  if (existing && existing.id !== excludeVehicleId) {
    throw createDuplicateVehicleNumberError(vehicleNumber);
  }
}

function toCreatePayload(values: CreateVehicleValues): VehicleCreateInput {
  return {
    vehicle_name: values.vehicle_name,
    vehicle_number: normalizeVehicleNumber(values.vehicle_number),
    brand: values.brand,
    color: values.color ?? null,
    fuel_type: values.fuel_type,
    transmission_type: values.transmission_type,
    default_daily_rate: values.default_daily_rate,
    // Explicit — never rely on DB column defaults for roster status.
    availability_status: values.availability_status,
    image_path: values.image_path ?? null,
    is_active: values.is_active,
    city: normalizeCityName(values.city) || DEFAULT_FLEET_CITY,
  };
}

function toUpdatePayload(values: UpdateVehicleValues): VehicleUpdateInput {
  const payload: VehicleUpdateInput = {
    ...values,
    ...(values.vehicle_number !== undefined
      ? { vehicle_number: normalizeVehicleNumber(values.vehicle_number) }
      : {}),
    ...(values.city !== undefined
      ? { city: normalizeCityName(values.city) || DEFAULT_FLEET_CITY }
      : {}),
  };

  // Drop keys Zod may materialize as explicit `undefined` so Supabase does not
  // clear unrelated columns on partial updates.
  for (const key of Object.keys(payload) as Array<keyof VehicleUpdateInput>) {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  }

  return payload;
}

export function createVehicleService(deps: VehicleServiceDeps = {}): VehicleService {
  const requirePerm = deps.requirePermission ?? requirePermission;

  async function getRepository(): Promise<VehicleRepository> {
    if (deps.repository) {
      return deps.repository;
    }

    if (deps.client) {
      return createVehicleRepository(deps.client);
    }

    return getVehicleRepository();
  }

  function getAvailability(): AvailabilityService {
    if (deps.availabilityService) {
      return deps.availabilityService;
    }

    if (deps.client) {
      return createAvailabilityService({
        client: deps.client,
        requirePermission: requirePerm,
      });
    }

    return getAvailabilityService();
  }

  const service: VehicleService = {
    createVehicle(input) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesWrite);
        const repository = await getRepository();
        const values = parseCreateInput(input);
        const payload = toCreatePayload(values);

        await ensureVehicleNumberUnique(repository, payload.vehicle_number);

        return repository.create(payload);
      });
    },

    updateVehicle(id, input) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesWrite);
        const repository = await getRepository();
        const existing = await repository.findById(id);

        if (!existing) {
          throw createVehicleNotFoundError();
        }

        const values = parseUpdateInput(input);
        const payload = toUpdatePayload(values);

        if (payload.vehicle_number) {
          await ensureVehicleNumberUnique(repository, payload.vehicle_number, id);
        }

        // Keep roster + availability aligned on soft-retire / reactivate.
        if (payload.is_active === false) {
          payload.availability_status = VEHICLE_AVAILABILITY_STATUSES.inactive;
        } else if (
          payload.is_active === true &&
          (existing.availability_status === VEHICLE_AVAILABILITY_STATUSES.inactive ||
            payload.availability_status === VEHICLE_AVAILABILITY_STATUSES.inactive)
        ) {
          payload.availability_status =
            payload.availability_status === VEHICLE_AVAILABILITY_STATUSES.inactive
              ? VEHICLE_AVAILABILITY_STATUSES.available
              : (payload.availability_status ?? VEHICLE_AVAILABILITY_STATUSES.available);
        }

        if (payload.availability_status === VEHICLE_AVAILABILITY_STATUSES.inactive) {
          payload.is_active = false;
        }

        const updated = await repository.update(id, payload);

        // After reactivating, recalculate from open bookings when status is booking-derived.
        if (
          payload.is_active === true &&
          updated.availability_status !== VEHICLE_AVAILABILITY_STATUSES.maintenance &&
          updated.availability_status !== VEHICLE_AVAILABILITY_STATUSES.inactive
        ) {
          const synced = await getAvailability().syncAvailabilityFromBookings(id);
          if (synced.success) {
            return synced.data;
          }
        }

        return updated;
      });
    },

    setVehicleImagePath(id, imagePath) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesWrite);
        const repository = await getRepository();
        const existing = await repository.findById(id);

        if (!existing) {
          throw createVehicleNotFoundError();
        }

        const trimmed = imagePath?.trim() ?? null;
        return repository.updateImagePath(id, trimmed && trimmed.length > 0 ? trimmed : null);
      });
    },

    deleteVehicle(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesDelete);
        const repository = await getRepository();
        const existing = await repository.findById(id);

        if (!existing) {
          throw createVehicleNotFoundError();
        }

        return repository.softDelete(id);
      });
    },

    permanentlyDeleteVehicle(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesDelete);
        const repository = await getRepository();
        await repository.delete(id);
        return null;
      });
    },

    getVehicle(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesRead);
        const repository = await getRepository();
        const vehicle = await repository.findById(id);

        if (!vehicle) {
          throw createVehicleNotFoundError();
        }

        return vehicle;
      });
    },

    getVehicleByNumber(vehicleNumber) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesRead);
        const normalized = normalizeVehicleNumber(vehicleNumber.trim());

        if (!normalized) {
          throw createVehicleValidationError('Vehicle number is required.');
        }

        const repository = await getRepository();
        const vehicle = await repository.findByNumber(normalized);

        if (!vehicle) {
          throw createVehicleNotFoundError();
        }

        return vehicle;
      });
    },

    listVehicles(query = {}) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesRead);
        const parsed = vehicleListQuerySchema.safeParse(query);

        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createVehicleValidationError(first?.message ?? 'Invalid list query.');
        }

        const repository = await getRepository();
        return repository.list(parsed.data);
      });
    },

    searchVehicles(search, query = {}) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesRead);
        const term = search.trim();

        if (!term) {
          throw createVehicleValidationError('Search term is required.');
        }

        const parsed = vehicleListQuerySchema.safeParse(query);

        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createVehicleValidationError(first?.message ?? 'Invalid search query.');
        }

        const repository = await getRepository();
        return repository.search(term, parsed.data);
      });
    },

    countVehicles(filters = {}) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesRead);
        const parsed = vehicleListFiltersSchema.safeParse(filters);

        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createVehicleValidationError(first?.message ?? 'Invalid vehicle filters.');
        }

        const repository = await getRepository();
        return repository.count(parsed.data);
      });
    },

    isVehicleAvailable(query) {
      return getAvailability().checkAvailability(query);
    },

    requireActiveVehicle(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.vehiclesRead);
        const repository = await getRepository();
        const vehicle = await repository.findById(id);

        if (!vehicle) {
          throw createVehicleNotFoundError();
        }

        if (!vehicle.is_active) {
          throw createInactiveVehicleError();
        }

        return vehicle;
      });
    },
  };

  return service;
}

/** Default request-scoped service (server client + live auth). */
export function getVehicleService(): VehicleService {
  return createVehicleService();
}

/** Exported for rare cases where a caller needs an explicit unauthorized error. */
export { createUnauthorizedVehicleAccessError };
