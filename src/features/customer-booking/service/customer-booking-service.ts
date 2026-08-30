/**
 * Customer booking REQUEST service.
 *
 * Creates draft bookings in the existing `bookings` table for admin approval.
 * Reuses Conflict / Pricing / Invoice / Availability engines — no parallel logic.
 *
 * Authoritative server values (never trusted from the client):
 * - created_by (auth user)
 * - status = draft
 * - daily_charge (vehicle rate)
 * - invoice_number (sequence RPC)
 * - duration / total_amount (Pricing Engine)
 * - booking_amount = 0, payment_method = null, payment_status = unpaid, document_submitted = false
 */

import 'server-only';

import {
  createBookingConflictError,
  createBookingDatabaseFailureError,
  createBookingNotFoundError,
  createBookingValidationError,
  createInvalidBookingDatesError,
  createUnauthorizedBookingAccessError,
  createVehicleUnavailableError,
} from '@/features/bookings/errors';
import {
  createBookingRepository,
  getBookingRepository,
  type BookingRepository,
} from '@/features/bookings/repository';
import {
  createConflictService,
  getConflictService,
  type ConflictService,
} from '@/features/bookings/service/conflict.service';
import {
  createInvoiceNumberService,
  getInvoiceNumberService,
  type InvoiceNumberService,
} from '@/features/bookings/service/invoice-number.service';
import {
  calculatePricing,
  pricingToPersistedFields,
} from '@/features/bookings/service/pricing.service';
import { citiesMatch } from '@/config/fleet-cities';
import {
  expandInclusiveDateRange,
  todayIsoIst,
} from '@/features/customer-booking/lib/calendar-dates';
import { customerSafeConflictMessage } from '@/features/customer-booking/lib/conflict-message';
import {
  customerBookingDatesSchema,
  customerBookingRequestSchema,
  customerVehicleBookedDatesSchema,
  type CustomerBookingRequestInput,
} from '@/features/customer-booking/validations/request';
import { readBookingCity } from '@/features/customer-location/lib/booking-city-cookie';
import {
  createAvailabilityService,
  type AvailabilityService,
} from '@/features/vehicles/service/availability.service';
import { getPublicVehicleService } from '@/features/vehicles/service/public-vehicle-service';
import { APP_ROLES, requireUser, type AuthUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { notifyBookingRequested } from '@/lib/notifications/booking-notifications';
import { toE164Phone } from '@/lib/notifications/phone';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fromPromise } from '@/services';
import type { ApiResponse, Booking, BookingCreateInput, BookingWithVehicle } from '@/types';
import { BOOKING_STATUSES } from '@/types/enums';

export interface CustomerBookingServiceDeps {
  readonly repository?: BookingRepository;
  readonly client?: TypedSupabaseClient;
  readonly invoiceNumberService?: InvoiceNumberService;
  readonly availabilityService?: AvailabilityService;
  readonly conflictService?: ConflictService;
  readonly requireUser?: typeof requireUser;
}

export interface CustomerBookingService {
  createBookingRequest(input: unknown): Promise<ApiResponse<Booking>>;
  checkRequestAvailability(input: unknown): Promise<ApiResponse<{ available: true }>>;
  listBookedDates(input: unknown): Promise<ApiResponse<{ readonly bookedDates: string[] }>>;
  getOwnBooking(bookingId: string): Promise<ApiResponse<Booking>>;
  getOwnBookingWithVehicle(bookingId: string): Promise<ApiResponse<BookingWithVehicle>>;
  listOwnBookings(): Promise<ApiResponse<readonly BookingWithVehicle[]>>;
}

function todayIsoBusiness(): string {
  return todayIsoIst();
}

function assertCustomerActor(actor: AuthUser): void {
  if (actor.role !== APP_ROLES.customer) {
    throw createUnauthorizedBookingAccessError();
  }
}

function assertNotInPast(deliveryDate: string): void {
  if (deliveryDate < todayIsoBusiness()) {
    throw createInvalidBookingDatesError('Pickup date cannot be in the past.');
  }
}

async function persistWhatsAppPreference(input: {
  readonly userId: string;
  readonly contactNumber: string;
  readonly optIn: boolean;
}): Promise<void> {
  if (!input.optIn) {
    return;
  }

  const phone = toE164Phone(input.contactNumber);
  if (!phone) {
    return;
  }

  try {
    const client = await createSupabaseServerClient();
    await client
      .from('profiles')
      .update({
        phone,
        whatsapp_opt_in: true,
        whatsapp_opt_in_at: new Date().toISOString(),
        whatsapp_opt_out_at: null,
      })
      .eq('id', input.userId);
  } catch (error) {
    console.error('[booking-notification] unable to persist WhatsApp preference', error);
  }
}

async function assertVehicleInSelectedCity(vehicleCity: string | null | undefined): Promise<void> {
  const bookingCity = await readBookingCity();
  if (!bookingCity) {
    throw createBookingValidationError('Select your city before requesting a car.');
  }

  if (!vehicleCity?.trim()) {
    throw createBookingValidationError('This car is not assigned to a city yet.');
  }

  if (!citiesMatch(vehicleCity, bookingCity)) {
    throw createBookingValidationError(`This car is not available in ${bookingCity}.`);
  }
}

async function ensureScheduleClearForRequest(
  availability: AvailabilityService,
  conflict: ConflictService,
  params: {
    vehicleId: string;
    deliveryDate: string;
    returnDate: string;
  },
): Promise<void> {
  try {
    await availability.assertVehicleBookable(params.vehicleId);
  } catch (error) {
    if (error instanceof AppError) {
      throw createVehicleUnavailableError(error.message);
    }
    throw error;
  }

  // Customer requests are stored as draft, but must still respect confirmed/ongoing
  // windows. Call detectConflicts directly — assertNoConflict no-ops for draft.
  const result = await conflict.detectConflicts({
    vehicleId: params.vehicleId,
    deliveryDate: params.deliveryDate,
    returnDate: params.returnDate,
  });

  if (!result.success) {
    throw result.error;
  }

  if (result.data.hasConflict && result.data.conflicts.length > 0) {
    const primary = result.data.conflicts[0]!;
    throw createBookingConflictError(
      primary,
      customerSafeConflictMessage(primary.deliveryDate, primary.returnDate),
    );
  }
}

async function findOpenDuplicateDraft(
  repository: BookingRepository,
  actorId: string,
  values: CustomerBookingRequestInput,
): Promise<Booking | null> {
  // Idempotency: reuse an open draft for the same customer + vehicle + dates
  // so retries do not create duplicate pending requests.
  const existing = await repository.list({
    vehicleId: values.vehicleId,
    status: BOOKING_STATUSES.draft,
    deliveryDateFrom: values.deliveryDate,
    deliveryDateTo: values.deliveryDate,
    returnDateFrom: values.returnDate,
    returnDateTo: values.returnDate,
    page: 1,
    pageSize: 10,
  });

  const match = existing.data.find(
    (row) =>
      row.created_by === actorId &&
      row.vehicle_id === values.vehicleId &&
      row.delivery_date === values.deliveryDate &&
      row.return_date === values.returnDate &&
      row.status === BOOKING_STATUSES.draft,
  );

  return match ?? null;
}

export function createCustomerBookingService(
  deps: CustomerBookingServiceDeps = {},
): CustomerBookingService {
  const requireActor = deps.requireUser ?? requireUser;

  async function getRepository(): Promise<BookingRepository> {
    if (deps.repository) {
      return deps.repository;
    }

    if (deps.client) {
      return createBookingRepository(deps.client);
    }

    return getBookingRepository();
  }

  function getInvoiceService(): InvoiceNumberService {
    if (deps.invoiceNumberService) {
      return deps.invoiceNumberService;
    }

    if (deps.client) {
      return createInvoiceNumberService({ client: deps.client });
    }

    return getInvoiceNumberService();
  }

  function getAvailability(): AvailabilityService {
    if (deps.availabilityService) {
      return deps.availabilityService;
    }

    if (deps.client) {
      return createAvailabilityService({
        client: deps.client,
        // Customer path must not require staff vehicle permissions.
        requirePermission: async () => requireActor(),
      });
    }

    return createAvailabilityService({
      requirePermission: async () => requireActor(),
    });
  }

  function getConflict(): ConflictService {
    if (deps.conflictService) {
      return deps.conflictService;
    }

    if (deps.client) {
      return createConflictService({ client: deps.client });
    }

    return getConflictService();
  }

  const service: CustomerBookingService = {
    checkRequestAvailability(input) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        const parsed = customerBookingDatesSchema.safeParse(input);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createBookingValidationError(first?.message ?? 'Invalid booking dates.');
        }

        assertNotInPast(parsed.data.deliveryDate);
        if (parsed.data.returnDate < parsed.data.deliveryDate) {
          throw createInvalidBookingDatesError();
        }

        const vehicleResult = await getPublicVehicleService().getPublicVehicle(
          parsed.data.vehicleId,
        );
        if (!vehicleResult.success) {
          throw vehicleResult.error;
        }

        const vehicle = vehicleResult.data;
        await assertVehicleInSelectedCity(vehicle.city);

        await ensureScheduleClearForRequest(getAvailability(), getConflict(), {
          vehicleId: parsed.data.vehicleId,
          deliveryDate: parsed.data.deliveryDate,
          returnDate: parsed.data.returnDate,
        });

        return { available: true as const };
      });
    },

    listBookedDates(input) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        const parsed = customerVehicleBookedDatesSchema.safeParse(input);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createBookingValidationError(first?.message ?? 'Invalid calendar range.');
        }

        const vehicleResult = await getPublicVehicleService().getPublicVehicle(
          parsed.data.vehicleId,
        );
        if (!vehicleResult.success) {
          throw vehicleResult.error;
        }

        const repository = await getRepository();
        const overlaps = await repository.findOverlappingForVehicle({
          vehicleId: parsed.data.vehicleId,
          deliveryDate: parsed.data.fromDate,
          returnDate: parsed.data.toDate,
        });

        const booked = new Set<string>();
        for (const row of overlaps) {
          for (const day of expandInclusiveDateRange(row.delivery_date, row.return_date)) {
            if (day >= parsed.data.fromDate && day <= parsed.data.toDate) {
              booked.add(day);
            }
          }
        }

        return { bookedDates: [...booked].sort() };
      });
    },

    createBookingRequest(input) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        const parsed = customerBookingRequestSchema.safeParse(input);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createBookingValidationError(first?.message ?? 'Invalid booking request.');
        }

        const values = parsed.data;
        assertNotInPast(values.deliveryDate);

        const repository = await getRepository();
        const duplicate = await findOpenDuplicateDraft(repository, actor.id, values);
        if (duplicate) {
          return duplicate;
        }

        const vehicleResult = await getPublicVehicleService().getPublicVehicle(values.vehicleId);
        if (!vehicleResult.success) {
          throw vehicleResult.error;
        }

        const vehicle = vehicleResult.data;
        await assertVehicleInSelectedCity(vehicle.city);
        const dailyCharge = Number(vehicle.default_daily_rate);

        if (!Number.isFinite(dailyCharge) || dailyCharge < 0) {
          throw createBookingValidationError('This vehicle does not have a valid daily rate.');
        }

        await ensureScheduleClearForRequest(getAvailability(), getConflict(), {
          vehicleId: values.vehicleId,
          deliveryDate: values.deliveryDate,
          returnDate: values.returnDate,
        });

        const invoiceNumber = await getInvoiceService().generateNextInvoiceNumber();
        const pricing = calculatePricing({
          dailyRate: dailyCharge,
          deliveryDate: values.deliveryDate,
          returnDate: values.returnDate,
          amountPaid: 0,
        });
        const priced = pricingToPersistedFields(pricing);

        const payload: BookingCreateInput = {
          invoice_number: invoiceNumber,
          vehicle_id: values.vehicleId,
          mode: values.mode,
          customer_name: values.customerName,
          address: values.address,
          city: values.city,
          state: values.state,
          zip_code: values.zipCode,
          place_to_visit: values.placeToVisit.trim() ? values.placeToVisit.trim() : null,
          contact_number: values.contactNumber,
          delivery_date: values.deliveryDate,
          return_date: values.returnDate,
          daily_charge: dailyCharge,
          duration: priced.duration,
          booking_amount: 0,
          total_amount: priced.total_amount,
          status: BOOKING_STATUSES.draft,
          document_submitted: false,
          payment_method: null,
          payment_status: 'unpaid',
          driver_name: null,
          fuel_range: null,
          notes: null,
          created_by: actor.id,
        };

        // Draft requests do not change vehicle availability — skip sync so a
        // customer JWT cannot attempt a staff-only vehicle update.
        const created = await repository.create(payload);
        await persistWhatsAppPreference({
          userId: actor.id,
          contactNumber: values.contactNumber,
          optIn: values.whatsappUpdates,
        });
        notifyBookingRequested({ booking: created });
        return created;
      });
    },

    getOwnBooking(bookingId) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        if (!bookingId.trim()) {
          throw createBookingValidationError('Booking id is required.');
        }

        const repository = await getRepository();
        const booking = await repository.findById(bookingId);

        if (!booking || booking.created_by !== actor.id) {
          throw createBookingNotFoundError();
        }

        return booking;
      });
    },

    getOwnBookingWithVehicle(bookingId) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        if (!bookingId.trim()) {
          throw createBookingValidationError('Booking id is required.');
        }

        const repository = await getRepository();
        const booking = await repository.findByIdWithVehicle(bookingId);

        if (!booking || booking.created_by !== actor.id) {
          // Hide existence of other customers' bookings.
          throw createBookingNotFoundError();
        }

        return booking;
      });
    },

    listOwnBookings() {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        const client = deps.client ?? (await createSupabaseServerClient());
        const { data, error } = await client
          .from('bookings')
          .select(
            '*, vehicle:vehicles(id, vehicle_name, vehicle_number, image_path, availability_status, is_active, fuel_type, default_daily_rate, brand, color, transmission_type)',
          )
          .eq('created_by', actor.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw createBookingDatabaseFailureError(error);
        }

        // Own booking SELECT covers draft / confirmed / denied / cancelled.
        // Vehicle embed is readable via vehicles_select_own_booking_history.
        return (data ?? []).filter((row): row is BookingWithVehicle => row.vehicle != null);
      });
    },
  };

  return service;
}

let singleton: CustomerBookingService | null = null;

export function getCustomerBookingService(): CustomerBookingService {
  if (!singleton) {
    singleton = createCustomerBookingService();
  }
  return singleton;
}
