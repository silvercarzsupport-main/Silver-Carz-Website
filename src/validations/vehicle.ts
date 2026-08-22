/**
 * Vehicle create / update Zod schemas.
 *
 * Output shapes align with Supabase `vehicles` insert/update columns (snake_case).
 */

import { z } from 'zod';

import { normalizeCityName } from '@/config/fleet-cities';
import { resolveIndianCity } from '@/config/indian-cities';
import {
  fuelTypeSchema,
  isoDateSchema,
  moneySchema,
  optionalNullableStringSchema,
  requiredString,
  transmissionTypeSchema,
  vehicleAvailabilityStatusSchema,
  vehicleNumberSchema,
} from '@/validations/shared';

const vehicleCitySchema = z
  .string()
  .trim()
  .min(1, 'City is required.')
  .superRefine((value, ctx) => {
    if (!resolveIndianCity(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a valid city from the list.',
      });
    }
  })
  .transform((value) => resolveIndianCity(value)!);

/**
 * Shared vehicle field shapes without create-only defaults.
 *
 * Defaults must NOT live on this object — `updateVehicleSchema` is `.partial()` of
 * these fields, and Zod `.default()` would re-inject values (e.g. `is_active: true`)
 * on partial updates like `{ image_path }`, wiping the saved status.
 */
const vehicleFieldsSchema = z.object({
  vehicle_name: requiredString('Vehicle name is required.').max(
    120,
    'Vehicle name must be at most 120 characters.',
  ),
  vehicle_number: vehicleNumberSchema,
  brand: requiredString('Brand is required.').max(80, 'Brand must be at most 80 characters.'),
  color: optionalNullableStringSchema,
  fuel_type: fuelTypeSchema,
  transmission_type: transmissionTypeSchema,
  default_daily_rate: moneySchema,
  availability_status: vehicleAvailabilityStatusSchema,
  image_path: optionalNullableStringSchema,
  is_active: z.boolean(),
  city: vehicleCitySchema,
});

/**
 * Create requires explicit status fields from the form/API.
 * Defaults live in the Add Vehicle form only — not on update/partial schemas.
 */
export const createVehicleSchema = vehicleFieldsSchema;

/** Update: only patch provided keys — never re-default omitted status fields. */
export const updateVehicleSchema = vehicleFieldsSchema.partial();

/** Form-friendly vehicle filters (camelCase query params). */
export const vehicleListFiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  fuelType: fuelTypeSchema.optional(),
  isActive: z.boolean().optional(),
  includeInactive: z.boolean().optional(),
  available: z.boolean().optional(),
  availabilityStatus: vehicleAvailabilityStatusSchema.optional(),
  createdFrom: isoDateSchema.optional(),
  createdTo: isoDateSchema.optional(),
  cursor: z.string().trim().min(1).optional(),
  city: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value ? normalizeCityName(value) : undefined)),
});

export const vehicleSortFieldSchema = z.enum([
  'vehicle_name',
  'vehicle_number',
  'fuel_type',
  'created_at',
  'updated_at',
]);

/** Full list query: filters + pagination + sorting. */
export const vehicleListQuerySchema = vehicleListFiltersSchema.extend({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  sortBy: vehicleSortFieldSchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateVehicleValues = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleValues = z.infer<typeof updateVehicleSchema>;
export type VehicleListFilterValues = z.infer<typeof vehicleListFiltersSchema>;
export type VehicleListQueryValues = z.infer<typeof vehicleListQuerySchema>;
