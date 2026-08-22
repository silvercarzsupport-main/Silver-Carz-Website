/**
 * Public (customer) vehicle read service.
 *
 * No staff permission checks — RLS `vehicles_select_public` enforces
 * active-only rows for anon/authenticated callers. Admin VehicleService
 * remains the sole write / full-fleet path.
 */

import 'server-only';

import { DEFAULT_FLEET_CITY, uniqueCityOptions } from '@/config/fleet-cities';
import { createVehicleNotFoundError } from '@/features/vehicles/errors';
import {
  getVehicleRepository,
  type VehicleRepository,
} from '@/features/vehicles/repository/vehicle-repository';
import { createPaginatedResult, normalizePaginationParams } from '@/lib/pagination';
import { fromPromise } from '@/services/result';
import type {
  ApiResponse,
  PaginatedResult,
  PublicVehicle,
  Vehicle,
  VehicleListQuery,
} from '@/types';

const PUBLIC_VEHICLE_PAGE_SIZE = 12;

function toPublicVehicle(vehicle: Vehicle): PublicVehicle {
  return {
    id: vehicle.id,
    vehicle_name: vehicle.vehicle_name,
    vehicle_number: vehicle.vehicle_number,
    brand: vehicle.brand,
    fuel_type: vehicle.fuel_type,
    transmission_type: vehicle.transmission_type,
    default_daily_rate: vehicle.default_daily_rate,
    color: vehicle.color,
    availability_status: vehicle.availability_status,
    image_path: vehicle.image_path,
    is_active: vehicle.is_active,
    city: vehicle.city,
  };
}

function sanitizePublicQuery(query?: VehicleListQuery): VehicleListQuery {
  return {
    ...query,
    isActive: true,
    includeInactive: false,
    page: query?.page ?? 1,
    pageSize: Math.min(query?.pageSize ?? PUBLIC_VEHICLE_PAGE_SIZE, 24),
    sortBy: query?.sortBy ?? 'vehicle_name',
    sortOrder: query?.sortOrder ?? 'asc',
  };
}

export interface PublicVehicleService {
  listPublicVehicles(
    query?: VehicleListQuery,
  ): Promise<ApiResponse<PaginatedResult<PublicVehicle>>>;
  getPublicVehicle(id: string): Promise<ApiResponse<PublicVehicle>>;
  listPublicVehicleCities(): Promise<ApiResponse<string[]>>;
}

export function createPublicVehicleService(deps?: {
  repository?: VehicleRepository;
}): PublicVehicleService {
  async function repository(): Promise<VehicleRepository> {
    return deps?.repository ?? getVehicleRepository();
  }

  return {
    listPublicVehicles(query) {
      return fromPromise(async () => {
        const city = query?.city?.trim();
        if (!city) {
          const pagination = normalizePaginationParams({
            page: query?.page,
            pageSize: query?.pageSize ?? PUBLIC_VEHICLE_PAGE_SIZE,
          });
          return createPaginatedResult<PublicVehicle>([], pagination, 0);
        }

        const result = await (await repository()).list(sanitizePublicQuery(query));
        return {
          ...result,
          data: result.data.map(toPublicVehicle),
        };
      });
    },

    getPublicVehicle(id) {
      return fromPromise(async () => {
        const vehicle = await (await repository()).findById(id);

        if (!vehicle || !vehicle.is_active) {
          throw createVehicleNotFoundError();
        }

        return toPublicVehicle(vehicle);
      });
    },

    listPublicVehicleCities() {
      return fromPromise(async () => {
        const cities = await (await repository()).listDistinctCities({ isActive: true });
        return uniqueCityOptions(cities.length > 0 ? cities : [DEFAULT_FLEET_CITY]);
      });
    },
  };
}

let singleton: PublicVehicleService | null = null;

export function getPublicVehicleService(): PublicVehicleService {
  if (!singleton) {
    singleton = createPublicVehicleService();
  }
  return singleton;
}
