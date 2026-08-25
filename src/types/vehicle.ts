/**
 * Vehicle domain models.
 *
 * Row / insert / update shapes are aliases of generated Supabase types —
 * do not redefine column interfaces here.
 */

import type { PaginationParams, SortParams } from '@/types/pagination';
import type { FuelType, VehicleAvailabilityStatus } from '@/types/enums';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

/** Persisted vehicle row (`public.vehicles`). */
export type Vehicle = Tables<'vehicles'>;

/** Columns safe to expose on the customer portal. */
export type PublicVehicle = Pick<
  Vehicle,
  | 'id'
  | 'vehicle_name'
  | 'vehicle_number'
  | 'brand'
  | 'fuel_type'
  | 'transmission_type'
  | 'default_daily_rate'
  | 'color'
  | 'availability_status'
  | 'image_path'
  | 'is_active'
  | 'city'
>;

/** Payload for inserting a vehicle (Supabase insert shape). */
export type VehicleCreateInput = TablesInsert<'vehicles'>;

/** Payload for updating a vehicle (Supabase update shape). */
export type VehicleUpdateInput = TablesUpdate<'vehicles'>;

/** Allowed sort columns for vehicle list queries. */
export type VehicleSortField =
  'vehicle_name' | 'vehicle_number' | 'fuel_type' | 'created_at' | 'updated_at';

/** Common list / filter inputs for vehicle queries. */
export interface VehicleListFilters {
  readonly search?: string;
  readonly fuelType?: FuelType;
  readonly isActive?: boolean;
  /**
   * When false (default), soft-retired (`is_active = false`) rows are excluded.
   * Ignored when `isActive` is set explicitly.
   */
  readonly includeInactive?: boolean;
  /**
   * Active vehicles with `availability_status = available`.
   * Pair with `excludeIds` (busy in a date window) for schedule-aware browse.
   */
  readonly available?: boolean;
  /** Exact match on `availability_status`. */
  readonly availabilityStatus?: VehicleAvailabilityStatus;
  /** Inclusive minimum on `default_daily_rate` (customer browse). */
  readonly minDailyRate?: number;
  /** Inclusive maximum on `default_daily_rate` (customer browse). */
  readonly maxDailyRate?: number;
  /**
   * Vehicle IDs to omit from the list (e.g. schedule conflicts in a date window).
   * Empty / omitted = no exclusion.
   */
  readonly excludeIds?: readonly string[];
  /** Exact city match (case-insensitive) for customer Book a Car. */
  readonly city?: string;
  readonly createdFrom?: string;
  readonly createdTo?: string;
  /**
   * Cursor-ready token for keyset pagination (unused by offset pagination today).
   * Reserved so list APIs can adopt cursors without breaking callers.
   */
  readonly cursor?: string;
}

/** Full list query: filters + pagination + sorting. */
export interface VehicleListQuery
  extends VehicleListFilters, Partial<PaginationParams>, SortParams<VehicleSortField> {}

/**
 * Availability check input. When delivery/return are set, the Availability
 * Engine delegates schedule overlap to the Booking Conflict Detection Engine.
 */
export interface VehicleAvailabilityQuery {
  readonly vehicleId: string;
  readonly deliveryDate?: string;
  readonly returnDate?: string;
  readonly excludeBookingId?: string;
}
