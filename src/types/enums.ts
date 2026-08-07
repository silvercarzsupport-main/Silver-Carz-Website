/**
 * Centralized domain enums aligned with Postgres / Supabase `Database` enums.
 *
 * Prefer these constants and types over string literals in application code.
 * Source of truth for values remains `src/types/database.ts` (generated).
 */

import type { SelectOption } from '@/types/common';
import type { Enums } from '@/types/database';

export type FuelType = Enums<'fuel_type'>;
export type TransmissionType = Enums<'transmission_type'>;
export type VehicleAvailabilityStatus = Enums<'vehicle_availability'>;
export type RentalMode = Enums<'rental_mode'>;
export type PaymentMethod = Enums<'payment_method'>;
export type BookingStatus = Enums<'booking_status'>;
export type PaymentProvider = Enums<'payment_provider'>;
export type BookingPaymentStatus = Enums<'booking_payment_status'>;

/** Application RBAC role — same values as `public.app_role`. */
export type UserRole = Enums<'app_role'>;

export const FUEL_TYPES = {
  petrol: 'petrol',
  diesel: 'diesel',
  cng: 'cng',
  electric: 'electric',
  hybrid: 'hybrid',
} as const satisfies Record<string, FuelType>;

export const FUEL_TYPE_VALUES = [
  FUEL_TYPES.petrol,
  FUEL_TYPES.diesel,
  FUEL_TYPES.cng,
  FUEL_TYPES.electric,
  FUEL_TYPES.hybrid,
] as const;

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'CNG',
  electric: 'Electric',
  hybrid: 'Hybrid',
};

/** Gearbox types common in the Indian passenger-car market. */
export const TRANSMISSION_TYPES = {
  manual: 'manual',
  automatic: 'automatic',
  amt: 'amt',
  cvt: 'cvt',
  dct: 'dct',
} as const satisfies Record<string, TransmissionType>;

export const TRANSMISSION_TYPE_VALUES = [
  TRANSMISSION_TYPES.manual,
  TRANSMISSION_TYPES.automatic,
  TRANSMISSION_TYPES.amt,
  TRANSMISSION_TYPES.cvt,
  TRANSMISSION_TYPES.dct,
] as const;

export const TRANSMISSION_TYPE_LABELS: Record<TransmissionType, string> = {
  manual: 'Manual',
  automatic: 'Automatic',
  amt: 'AMT',
  cvt: 'CVT',
  dct: 'DCT',
};

export const VEHICLE_AVAILABILITY_STATUSES = {
  available: 'available',
  booked: 'booked',
  reserved: 'reserved',
  maintenance: 'maintenance',
  inactive: 'inactive',
} as const satisfies Record<string, VehicleAvailabilityStatus>;

export const VEHICLE_AVAILABILITY_STATUS_VALUES = [
  VEHICLE_AVAILABILITY_STATUSES.available,
  VEHICLE_AVAILABILITY_STATUSES.booked,
  VEHICLE_AVAILABILITY_STATUSES.reserved,
  VEHICLE_AVAILABILITY_STATUSES.maintenance,
  VEHICLE_AVAILABILITY_STATUSES.inactive,
] as const;

export const VEHICLE_AVAILABILITY_STATUS_LABELS: Record<VehicleAvailabilityStatus, string> = {
  available: 'Available',
  booked: 'Booked',
  reserved: 'Reserved',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
};

/** Statuses that block creating / assigning a new booking. */
export const VEHICLE_UNBOOKABLE_STATUSES = [
  VEHICLE_AVAILABILITY_STATUSES.booked,
  VEHICLE_AVAILABILITY_STATUSES.reserved,
  VEHICLE_AVAILABILITY_STATUSES.maintenance,
  VEHICLE_AVAILABILITY_STATUSES.inactive,
] as const;

/** Statuses that may be overwritten by booking-driven sync. */
export const VEHICLE_BOOKING_DERIVED_STATUSES = [
  VEHICLE_AVAILABILITY_STATUSES.available,
  VEHICLE_AVAILABILITY_STATUSES.booked,
  VEHICLE_AVAILABILITY_STATUSES.reserved,
] as const;

export const RENTAL_MODES = {
  withDriver: 'with_driver',
  withoutDriver: 'without_driver',
} as const satisfies Record<string, RentalMode>;

export const RENTAL_MODE_VALUES = [RENTAL_MODES.withDriver, RENTAL_MODES.withoutDriver] as const;

export const RENTAL_MODE_LABELS: Record<RentalMode, string> = {
  with_driver: 'With driver',
  without_driver: 'Without driver',
};

export const PAYMENT_METHODS = {
  cash: 'cash',
  upi: 'upi',
  card: 'card',
  bankTransfer: 'bank_transfer',
  cheque: 'cheque',
  other: 'other',
} as const satisfies Record<string, PaymentMethod>;

export const PAYMENT_METHOD_VALUES = [
  PAYMENT_METHODS.cash,
  PAYMENT_METHODS.upi,
  PAYMENT_METHODS.card,
  PAYMENT_METHODS.bankTransfer,
  PAYMENT_METHODS.cheque,
  PAYMENT_METHODS.other,
] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  other: 'Other',
};

export const BOOKING_STATUSES = {
  draft: 'draft',
  confirmed: 'confirmed',
  ongoing: 'ongoing',
  completed: 'completed',
  cancelled: 'cancelled',
  denied: 'denied',
} as const satisfies Record<string, BookingStatus>;

export const BOOKING_STATUS_VALUES = [
  BOOKING_STATUSES.draft,
  BOOKING_STATUSES.confirmed,
  BOOKING_STATUSES.ongoing,
  BOOKING_STATUSES.completed,
  BOOKING_STATUSES.cancelled,
  BOOKING_STATUSES.denied,
] as const;

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  denied: 'Denied',
};

export const PAYMENT_PROVIDERS = {
  razorpay: 'razorpay',
} as const satisfies Record<string, PaymentProvider>;

export const PAYMENT_PROVIDER_VALUES = [PAYMENT_PROVIDERS.razorpay] as const;

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  razorpay: 'Razorpay',
};

export const BOOKING_PAYMENT_STATUSES = {
  pending: 'pending',
  failed: 'failed',
  cancelled: 'cancelled',
  paid: 'paid',
} as const satisfies Record<string, BookingPaymentStatus>;

export const BOOKING_PAYMENT_STATUS_VALUES = [
  BOOKING_PAYMENT_STATUSES.pending,
  BOOKING_PAYMENT_STATUSES.failed,
  BOOKING_PAYMENT_STATUSES.cancelled,
  BOOKING_PAYMENT_STATUSES.paid,
] as const;

export const BOOKING_PAYMENT_STATUS_LABELS: Record<BookingPaymentStatus, string> = {
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
  paid: 'Paid',
};

/**
 * Role constants live in `@/lib/auth/roles` (used by RBAC helpers).
 * Re-exported here so domain code can import enums from one place.
 */
export {
  APP_ROLES as USER_ROLES,
  APP_ROLE_VALUES as USER_ROLE_VALUES,
  APP_ROLE_LABELS as USER_ROLE_LABELS,
  isAppRole as isUserRole,
  type AppRole,
} from '@/lib/auth/roles';

export const FUEL_TYPE_OPTIONS: SelectOption<FuelType>[] = FUEL_TYPE_VALUES.map((value) => ({
  value,
  label: FUEL_TYPE_LABELS[value],
}));

export const TRANSMISSION_TYPE_OPTIONS: SelectOption<TransmissionType>[] =
  TRANSMISSION_TYPE_VALUES.map((value) => ({
    value,
    label: TRANSMISSION_TYPE_LABELS[value],
  }));

export const VEHICLE_AVAILABILITY_STATUS_OPTIONS: SelectOption<VehicleAvailabilityStatus>[] =
  VEHICLE_AVAILABILITY_STATUS_VALUES.map((value) => ({
    value,
    label: VEHICLE_AVAILABILITY_STATUS_LABELS[value],
  }));

export const RENTAL_MODE_OPTIONS: SelectOption<RentalMode>[] = RENTAL_MODE_VALUES.map((value) => ({
  value,
  label: RENTAL_MODE_LABELS[value],
}));

export const PAYMENT_METHOD_OPTIONS: SelectOption<PaymentMethod>[] = PAYMENT_METHOD_VALUES.map(
  (value) => ({
    value,
    label: PAYMENT_METHOD_LABELS[value],
  }),
);

export const BOOKING_STATUS_OPTIONS: SelectOption<BookingStatus>[] = BOOKING_STATUS_VALUES.map(
  (value) => ({
    value,
    label: BOOKING_STATUS_LABELS[value],
  }),
);

const FUEL_TYPE_SET = new Set<string>(FUEL_TYPE_VALUES);
const TRANSMISSION_TYPE_SET = new Set<string>(TRANSMISSION_TYPE_VALUES);
const VEHICLE_AVAILABILITY_STATUS_SET = new Set<string>(VEHICLE_AVAILABILITY_STATUS_VALUES);
const RENTAL_MODE_SET = new Set<string>(RENTAL_MODE_VALUES);
const PAYMENT_METHOD_SET = new Set<string>(PAYMENT_METHOD_VALUES);
const BOOKING_STATUS_SET = new Set<string>(BOOKING_STATUS_VALUES);
const PAYMENT_PROVIDER_SET = new Set<string>(PAYMENT_PROVIDER_VALUES);
const BOOKING_PAYMENT_STATUS_SET = new Set<string>(BOOKING_PAYMENT_STATUS_VALUES);

export function isFuelType(value: unknown): value is FuelType {
  return typeof value === 'string' && FUEL_TYPE_SET.has(value);
}

export function isTransmissionType(value: unknown): value is TransmissionType {
  return typeof value === 'string' && TRANSMISSION_TYPE_SET.has(value);
}

export function isVehicleAvailabilityStatus(value: unknown): value is VehicleAvailabilityStatus {
  return typeof value === 'string' && VEHICLE_AVAILABILITY_STATUS_SET.has(value);
}

export function isVehicleBookableStatus(status: VehicleAvailabilityStatus): boolean {
  return status === VEHICLE_AVAILABILITY_STATUSES.available;
}

export function isRentalMode(value: unknown): value is RentalMode {
  return typeof value === 'string' && RENTAL_MODE_SET.has(value);
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && PAYMENT_METHOD_SET.has(value);
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === 'string' && BOOKING_STATUS_SET.has(value);
}

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return typeof value === 'string' && PAYMENT_PROVIDER_SET.has(value);
}

export function isBookingPaymentStatus(value: unknown): value is BookingPaymentStatus {
  return typeof value === 'string' && BOOKING_PAYMENT_STATUS_SET.has(value);
}
