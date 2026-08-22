'use server';

/**
 * Public customer vehicle list — no staff permission gate.
 * RLS restricts results to active vehicles.
 */

import { getPublicVehicleService } from '@/features/vehicles/service/public-vehicle-service';
import type { ApiResponse, PaginatedResult, PublicVehicle, VehicleListQuery } from '@/types';

export async function listPublicVehicles(
  query?: VehicleListQuery,
): Promise<ApiResponse<PaginatedResult<PublicVehicle>>> {
  return getPublicVehicleService().listPublicVehicles(query);
}

export async function getPublicVehicle(id: string): Promise<ApiResponse<PublicVehicle>> {
  return getPublicVehicleService().getPublicVehicle(id);
}

export async function listPublicVehicleCities(): Promise<ApiResponse<string[]>> {
  return getPublicVehicleService().listPublicVehicleCities();
}
