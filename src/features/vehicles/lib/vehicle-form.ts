/**
 * Shared Vehicle form defaults, field helpers, and payload mapping.
 *
 * Used by Create and Edit. Validation rules live in `@/validations` —
 * this module only shapes UX values.
 */

import { DEFAULT_FLEET_CITY } from '@/config/fleet-cities';
import { resolveIndianCity } from '@/config/indian-cities';
import type { FuelType, TransmissionType, Vehicle, VehicleAvailabilityStatus } from '@/types';
import { VEHICLE_AVAILABILITY_STATUSES } from '@/types';
import {
  createVehicleSchema,
  type CreateVehicleValues,
  type UpdateVehicleValues,
} from '@/validations';

export type VehicleStatusValue = 'active' | 'inactive';

/** Form field values before Zod parse (empty strings for optional text). */
export type VehicleFormValues = {
  vehicle_name: string;
  vehicle_number: string;
  brand: string;
  color: string;
  fuel_type: FuelType | '';
  transmission_type: TransmissionType | '';
  default_daily_rate: number | null;
  availability_status: VehicleAvailabilityStatus;
  /** UI string — mapped to `is_active` boolean for the API/DB. */
  vehicle_status: VehicleStatusValue;
  city: string;
};

export type VehicleFormFieldErrors = Partial<Record<keyof VehicleFormValues, string>>;

export const VEHICLE_STATUS_OPTIONS: ReadonlyArray<{
  readonly value: VehicleStatusValue;
  readonly label: string;
}> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function createVehicleFormDefaults(): VehicleFormValues {
  return {
    vehicle_name: '',
    vehicle_number: '',
    brand: '',
    color: '',
    fuel_type: '',
    transmission_type: '',
    default_daily_rate: null,
    availability_status: VEHICLE_AVAILABILITY_STATUSES.available,
    vehicle_status: 'active',
    city: DEFAULT_FLEET_CITY,
  };
}

/** Map a persisted vehicle row into editable form values. */
export function vehicleToFormValues(vehicle: Vehicle): VehicleFormValues {
  return {
    vehicle_name: vehicle.vehicle_name,
    vehicle_number: vehicle.vehicle_number,
    brand: vehicle.brand,
    color: vehicle.color ?? '',
    fuel_type: vehicle.fuel_type,
    transmission_type: vehicle.transmission_type,
    default_daily_rate: vehicle.default_daily_rate,
    availability_status: vehicle.availability_status,
    vehicle_status: vehicle.is_active ? 'active' : 'inactive',
    city: resolveIndianCity(vehicle.city || '') ?? (vehicle.city || DEFAULT_FLEET_CITY),
  };
}

export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function mapZodFieldErrors(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): VehicleFormFieldErrors {
  const fieldErrors: VehicleFormFieldErrors = {};

  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key !== 'string') {
      continue;
    }

    if (key === 'is_active') {
      if (!fieldErrors.vehicle_status) {
        fieldErrors.vehicle_status = issue.message;
      }
      continue;
    }

    if (!(key in fieldErrors)) {
      fieldErrors[key as keyof VehicleFormValues] = issue.message;
    }
  }

  return fieldErrors;
}

export function toCreateVehicleInput(values: VehicleFormValues): unknown {
  return {
    vehicle_name: values.vehicle_name,
    vehicle_number: values.vehicle_number,
    brand: values.brand,
    color: values.color,
    fuel_type: values.fuel_type || undefined,
    transmission_type: values.transmission_type || undefined,
    default_daily_rate: values.default_daily_rate,
    availability_status: values.availability_status,
    image_path: null,
    is_active: values.vehicle_status === 'active',
    city: resolveIndianCity(values.city) ?? DEFAULT_FLEET_CITY,
  };
}

/**
 * Update payload omits `image_path` so field saves never wipe Storage paths.
 * Image replace / remove is handled by dedicated Server Actions.
 */
export function toUpdateVehicleInput(values: VehicleFormValues): Record<string, unknown> {
  const createInput = toCreateVehicleInput(values) as Record<string, unknown>;
  const { image_path: _ignored, ...rest } = createInput;
  return rest;
}

export function validateCreateVehicleForm(
  values: VehicleFormValues,
):
  | { success: true; data: CreateVehicleValues }
  | { success: false; fieldErrors: VehicleFormFieldErrors; formError: string } {
  const parsed = createVehicleSchema.safeParse(toCreateVehicleInput(values));

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  const fieldErrors = mapZodFieldErrors(parsed.error.issues);
  const first = parsed.error.issues[0];

  return {
    success: false,
    fieldErrors,
    formError: first?.message ?? 'Please correct the highlighted fields.',
  };
}

/**
 * Full-form validation for edit (same field rules as create).
 * Uses `createVehicleSchema` so partial update schema cannot skip required fields.
 * `image_path` is stripped from the result — image changes use Storage actions.
 */
export function validateUpdateVehicleForm(
  values: VehicleFormValues,
):
  | { success: true; data: UpdateVehicleValues }
  | { success: false; fieldErrors: VehicleFormFieldErrors; formError: string } {
  const parsed = createVehicleSchema.safeParse({
    ...toUpdateVehicleInput(values),
    image_path: null,
  });

  if (parsed.success) {
    const { image_path: _omit, ...data } = parsed.data;
    return { success: true, data };
  }

  const fieldErrors = mapZodFieldErrors(parsed.error.issues);
  const first = parsed.error.issues[0];

  return {
    success: false,
    fieldErrors,
    formError: first?.message ?? 'Please correct the highlighted fields.',
  };
}

/** Normalize registration as the user types (uppercase, collapse spaces). */
export function normalizeRegistrationInput(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}
