/**
 * Booking service — business rules, authorization, and repository orchestration.
 *
 * Server Actions and future API routes call this layer only.
 * Never import the repository from UI code.
 */

import 'server-only';

import {
  BOOKING_ERROR_CODES,
  createBookingAlreadyProcessedError,
  createBookingDocumentsIncompleteError,
  createBookingNotFoundError,
  createBookingValidationError,
  createDuplicateInvoiceError,
  createInvalidBookingDatesError,
  createUnauthorizedBookingAccessError,
  createVehicleUnavailableError,
} from '@/features/bookings/errors';
import { bookingDocumentLabel, requiredBookingDocumentTypes } from '@/constants/booking-documents';
import { getBookingDocumentCompleteness } from '@/features/booking-documents/lib/completeness';
import {
  createBookingDocumentRepository,
  getBookingDocumentRepository,
  type BookingDocumentRepository,
} from '@/features/booking-documents/repository/booking-document-repository';
import { computePaymentDueAt } from '@/features/bookings/lib/payment-window';
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
import {
  getBookingStatusService,
  resolvePersistedBookingStatus,
  type BookingStatusService,
} from '@/features/bookings/service/status.service';
import {
  createAvailabilityService,
  getAvailabilityService,
  type AvailabilityService,
} from '@/features/vehicles/service/availability.service';
import { PERMISSIONS, requirePermission, type AuthUser } from '@/lib/auth';
import { getProfileById } from '@/lib/auth/profile';
import { AppError } from '@/lib/errors';
import {
  notifyBookingApproved,
  notifyBookingRejected,
} from '@/lib/notifications/booking-notifications';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { fromPromise } from '@/services';
import type {
  Booking,
  BookingCreateInput,
  BookingListFilters,
  BookingListQuery,
  BookingUpdateInput,
  BookingWithVehicle,
  PaginatedResult,
} from '@/types';
import type { ApiResponse } from '@/types';
import {
  bookingListFiltersSchema,
  bookingListQuerySchema,
  createBookingSchema,
  updateBookingSchema,
  type CreateBookingValues,
  type UpdateBookingValues,
} from '@/validations';
import { BOOKING_STATUSES } from '@/types/enums';

export interface BookingServiceDeps {
  readonly repository?: BookingRepository;
  readonly documentRepository?: BookingDocumentRepository;
  readonly client?: TypedSupabaseClient;
  readonly invoiceNumberService?: InvoiceNumberService;
  readonly availabilityService?: AvailabilityService;
  readonly conflictService?: ConflictService;
  readonly statusService?: BookingStatusService;
  /** Optional override for tests; defaults to `requirePermission`. */
  readonly requirePermission?: typeof requirePermission;
}

export interface BookingService {
  createBooking(input: unknown): Promise<ApiResponse<Booking>>;
  updateBooking(id: string, input: unknown): Promise<ApiResponse<Booking>>;
  /** Soft-delete (status → cancelled). Preferred application delete. */
  deleteBooking(id: string): Promise<ApiResponse<Booking>>;
  /** Graduate a draft customer request into a confirmed fleet booking (payment-eligible). */
  approveBooking(id: string): Promise<ApiResponse<Booking>>;
  /** Deny a draft customer request (status → denied, historic only). */
  rejectBooking(id: string, reason: string): Promise<ApiResponse<Booking>>;
  /** Permanent delete — reserved for trusted admin flows. */
  permanentlyDeleteBooking(id: string): Promise<ApiResponse<null>>;
  getBooking(id: string): Promise<ApiResponse<Booking>>;
  getBookingWithVehicle(id: string): Promise<ApiResponse<BookingWithVehicle>>;
  getBookingByInvoiceNumber(invoiceNumber: string): Promise<ApiResponse<Booking>>;
  listBookings(query?: BookingListQuery): Promise<ApiResponse<PaginatedResult<BookingWithVehicle>>>;
  searchBookings(
    search: string,
    query?: BookingListQuery,
  ): Promise<ApiResponse<PaginatedResult<BookingWithVehicle>>>;
  countBookings(filters?: BookingListFilters): Promise<ApiResponse<number>>;
  /** Non-allocating preview for the create form. */
  previewNextInvoiceNumber(issuedOn?: string): Promise<string>;
}

function assertValidDates(deliveryDate: string, returnDate: string): void {
  if (returnDate < deliveryDate) {
    throw createInvalidBookingDatesError();
  }
}

function parseCreateInput(input: unknown): CreateBookingValues {
  const parsed = createBookingSchema.safeParse(input);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw createBookingValidationError(first?.message ?? 'Invalid booking details.');
  }

  return parsed.data;
}

function parseUpdateInput(input: unknown): UpdateBookingValues {
  const parsed = updateBookingSchema.safeParse(input);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw createBookingValidationError(first?.message ?? 'Invalid booking details.');
  }

  return parsed.data;
}

async function ensureInvoiceUnique(
  repository: BookingRepository,
  invoiceNumber: string,
  excludeBookingId?: string,
): Promise<void> {
  const existing = await repository.findByInvoiceNumber(invoiceNumber);

  if (existing && existing.id !== excludeBookingId) {
    throw createDuplicateInvoiceError(invoiceNumber);
  }
}

/**
 * Operational bookability + schedule conflict detection.
 * Conflict rules live in ConflictService — never duplicate them here.
 */
async function ensureVehicleScheduleClear(
  availability: AvailabilityService,
  conflict: ConflictService,
  params: {
    vehicleId: string;
    deliveryDate: string;
    returnDate: string;
    excludeBookingId?: string;
    /** Skip overlap enforcement for draft / cancelled targets. */
    status?: string | null;
  },
): Promise<void> {
  if (
    params.status === BOOKING_STATUSES.cancelled ||
    params.status === BOOKING_STATUSES.denied ||
    params.status === BOOKING_STATUSES.draft
  ) {
    return;
  }

  try {
    await availability.assertVehicleBookable(params.vehicleId);
  } catch (error) {
    if (error instanceof AppError) {
      throw createVehicleUnavailableError(error.message);
    }
    throw error;
  }

  await conflict.assertNoConflict({
    vehicleId: params.vehicleId,
    deliveryDate: params.deliveryDate,
    returnDate: params.returnDate,
    excludeBookingId: params.excludeBookingId,
    status: params.status,
  });
}

function applyCreateDerivedFields(
  values: CreateBookingValues,
  actor: AuthUser,
  invoiceNumber: string,
): BookingCreateInput {
  assertValidDates(values.delivery_date, values.return_date);

  // Pricing Engine is the sole authority for duration and money totals.
  const pricing = calculatePricing({
    dailyRate: values.daily_charge,
    deliveryDate: values.delivery_date,
    returnDate: values.return_date,
    amountPaid: values.booking_amount,
  });
  const priced = pricingToPersistedFields(pricing);

  // Draft stays draft; otherwise Status Service owns lifecycle persistence.
  const status =
    values.status === BOOKING_STATUSES.draft
      ? BOOKING_STATUSES.draft
      : resolvePersistedBookingStatus({
          status: values.status,
          delivery_date: values.delivery_date,
          return_date: values.return_date,
        });

  return {
    ...values,
    invoice_number: invoiceNumber,
    duration: priced.duration,
    booking_amount: priced.booking_amount,
    total_amount: priced.total_amount,
    status,
    created_by: values.created_by ?? actor.id,
  };
}

function applyUpdateDerivedFields(
  existing: Booking,
  values: UpdateBookingValues,
): BookingUpdateInput {
  const deliveryDate = values.delivery_date ?? existing.delivery_date;
  const returnDate = values.return_date ?? existing.return_date;
  assertValidDates(deliveryDate, returnDate);

  const dailyCharge = values.daily_charge ?? existing.daily_charge;
  const amountPaid =
    values.booking_amount !== undefined ? values.booking_amount : existing.booking_amount;

  // Always rematerialize derived money via Pricing Engine.
  const pricing = calculatePricing({
    dailyRate: dailyCharge,
    deliveryDate,
    returnDate,
    amountPaid,
  });
  const priced = pricingToPersistedFields(pricing);

  // Manual status edits are ignored. Terminal statuses stay terminal; otherwise
  // Status Service recomputes lifecycle from dates (drafts graduate on save).
  const { status: _ignoredClientStatus, ...safeWithoutStatus } = values;
  const status =
    existing.status === BOOKING_STATUSES.cancelled
      ? BOOKING_STATUSES.cancelled
      : existing.status === BOOKING_STATUSES.denied
        ? BOOKING_STATUSES.denied
        : resolvePersistedBookingStatus({
            status: existing.status === BOOKING_STATUSES.draft ? undefined : existing.status,
            delivery_date: deliveryDate,
            return_date: returnDate,
          });

  return {
    ...safeWithoutStatus,
    duration: priced.duration,
    booking_amount: priced.booking_amount,
    total_amount: priced.total_amount,
    status,
  };
}

export function createBookingService(deps: BookingServiceDeps = {}): BookingService {
  const requirePerm = deps.requirePermission ?? requirePermission;

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
        requirePermission: requirePerm,
      });
    }

    return getAvailabilityService();
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

  function getStatus(): BookingStatusService {
    if (deps.statusService) {
      return deps.statusService;
    }

    return getBookingStatusService();
  }

  async function getDocuments(): Promise<BookingDocumentRepository> {
    if (deps.documentRepository) {
      return deps.documentRepository;
    }

    if (deps.client) {
      return createBookingDocumentRepository(deps.client);
    }

    return getBookingDocumentRepository();
  }

  async function syncVehicleAvailability(vehicleId: string | null | undefined): Promise<void> {
    if (!vehicleId) {
      return;
    }

    await getAvailability().syncAvailabilityFromBookings(vehicleId);
  }

  async function assertRequiredDocumentsComplete(bookingId: string): Promise<void> {
    const documents = await getDocuments();
    const rows = await documents.listForBooking(bookingId);
    const completeness = getBookingDocumentCompleteness(rows.map((row) => row.document_type));

    if (!completeness.isComplete) {
      throw createBookingDocumentsIncompleteError(completeness.missingLabels);
    }
  }

  const service: BookingService = {
    createBooking(input) {
      return fromPromise(async () => {
        const actor = await requirePerm(PERMISSIONS.bookingsWrite);
        const repository = await getRepository();
        const invoiceService = getInvoiceService();
        const availability = getAvailability();
        const conflict = getConflict();
        const statusEngine = getStatus();
        const values = parseCreateInput(input);

        assertValidDates(values.delivery_date, values.return_date);

        const scheduleStatus =
          values.status === BOOKING_STATUSES.draft
            ? BOOKING_STATUSES.draft
            : statusEngine.resolvePersistedStatus({
                status: values.status,
                delivery_date: values.delivery_date,
                return_date: values.return_date,
              });

        // Validate → operational status → conflict → invoice → save
        await ensureVehicleScheduleClear(availability, conflict, {
          vehicleId: values.vehicle_id,
          deliveryDate: values.delivery_date,
          returnDate: values.return_date,
          status: scheduleStatus,
        });

        const invoiceNumber = await invoiceService.generateNextInvoiceNumber({
          issuedOn: values.invoice_date,
        });
        const payload = applyCreateDerivedFields(values, actor, invoiceNumber);

        await ensureInvoiceUnique(repository, payload.invoice_number);

        const created = await repository.create(payload);
        await syncVehicleAvailability(created.vehicle_id);
        return created;
      });
    },

    updateBooking(id, input) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsWrite);
        const repository = await getRepository();
        const availability = getAvailability();
        const conflict = getConflict();
        const existing = await repository.findById(id);

        if (!existing) {
          throw createBookingNotFoundError();
        }

        const values = parseUpdateInput(input);
        const { invoice_number: _ignoredInvoice, ...safeValues } = values;
        const payload = applyUpdateDerivedFields(existing, safeValues);

        const vehicleId = payload.vehicle_id ?? existing.vehicle_id;
        const deliveryDate = payload.delivery_date ?? existing.delivery_date;
        const returnDate = payload.return_date ?? existing.return_date;
        const status = payload.status ?? existing.status;

        await ensureVehicleScheduleClear(availability, conflict, {
          vehicleId,
          deliveryDate,
          returnDate,
          excludeBookingId: id,
          status,
        });

        const updated = await repository.update(id, payload);

        await syncVehicleAvailability(existing.vehicle_id);
        if (updated.vehicle_id !== existing.vehicle_id) {
          await syncVehicleAvailability(updated.vehicle_id);
        }

        return updated;
      });
    },

    deleteBooking(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsDelete);
        const repository = await getRepository();
        const existing = await repository.findById(id);

        if (!existing) {
          throw createBookingNotFoundError();
        }

        const cancelled = await repository.softDelete(id);
        await syncVehicleAvailability(existing.vehicle_id);
        return cancelled;
      });
    },

    approveBooking(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsWrite);
        const repository = await getRepository();
        const availability = getAvailability();
        const conflict = getConflict();
        const statusEngine = getStatus();
        const existing = await repository.findById(id);

        if (!existing) {
          throw createBookingNotFoundError();
        }

        if (existing.status !== BOOKING_STATUSES.draft) {
          throw createBookingAlreadyProcessedError();
        }

        if (!existing.document_submitted) {
          const requiredLabels = requiredBookingDocumentTypes().map((type) =>
            bookingDocumentLabel(type),
          );
          throw createBookingDocumentsIncompleteError(requiredLabels);
        }

        await assertRequiredDocumentsComplete(id);

        // Existing architecture: approval graduates draft → schedule-blocking
        // confirmed/ongoing/completed. Payment collection (C6) uses booking_amount.
        const status = statusEngine.resolvePersistedStatus({
          status: undefined,
          delivery_date: existing.delivery_date,
          return_date: existing.return_date,
        });

        try {
          await ensureVehicleScheduleClear(availability, conflict, {
            vehicleId: existing.vehicle_id,
            deliveryDate: existing.delivery_date,
            returnDate: existing.return_date,
            excludeBookingId: id,
            status,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === BOOKING_ERROR_CODES.vehicleUnavailable) {
            throw createVehicleUnavailableError(
              'This vehicle is no longer available for the requested dates.',
            );
          }
          throw error;
        }

        const approved = await repository.updateIfStatus(id, BOOKING_STATUSES.draft, {
          status,
          rejection_reason: null,
          payment_due_at: computePaymentDueAt(existing.delivery_date),
        });

        if (!approved) {
          throw createBookingAlreadyProcessedError();
        }

        await syncVehicleAvailability(existing.vehicle_id);

        const customerId = approved.created_by;
        if (customerId) {
          const customerProfile = await getProfileById(customerId);
          if (customerProfile?.email) {
            notifyBookingApproved({
              booking: approved,
              customerEmail: customerProfile.email,
            });
          }
        }

        return approved;
      });
    },

    rejectBooking(id, reason) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsWrite);
        const repository = await getRepository();
        const existing = await repository.findById(id);

        if (!existing) {
          throw createBookingNotFoundError();
        }

        if (existing.status !== BOOKING_STATUSES.draft) {
          throw createBookingAlreadyProcessedError();
        }

        const trimmedReason = reason.trim();
        if (!trimmedReason) {
          throw createBookingValidationError('A rejection reason is required.');
        }

        if (trimmedReason.length > 1000) {
          throw createBookingValidationError('Rejection reason must be 1000 characters or fewer.');
        }

        const denied = await repository.updateIfStatus(id, BOOKING_STATUSES.draft, {
          status: BOOKING_STATUSES.denied,
          rejection_reason: trimmedReason,
        });

        if (!denied) {
          throw createBookingAlreadyProcessedError();
        }

        await syncVehicleAvailability(existing.vehicle_id);

        const customerId = denied.created_by;
        if (customerId) {
          const customerProfile = await getProfileById(customerId);
          if (customerProfile?.email) {
            notifyBookingRejected({
              booking: denied,
              customerEmail: customerProfile.email,
              reason: trimmedReason,
            });
          }
        }

        return denied;
      });
    },

    permanentlyDeleteBooking(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsDelete);
        const repository = await getRepository();
        const existing = await repository.findById(id);
        const vehicleId = existing?.vehicle_id;
        await repository.delete(id);
        await syncVehicleAvailability(vehicleId);
        return null;
      });
    },

    getBooking(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsRead);
        const repository = await getRepository();
        const booking = await repository.findById(id);

        if (!booking) {
          throw createBookingNotFoundError();
        }

        return booking;
      });
    },

    getBookingWithVehicle(id) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsRead);
        const repository = await getRepository();
        const booking = await repository.findByIdWithVehicle(id);

        if (!booking) {
          // Distinguish missing booking vs missing vehicle join.
          const bare = await repository.findById(id);
          if (!bare) {
            throw createBookingNotFoundError();
          }
          throw createBookingValidationError('Booking vehicle could not be loaded.');
        }

        return booking;
      });
    },

    getBookingByInvoiceNumber(invoiceNumber) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsRead);
        const normalized = invoiceNumber.trim().toUpperCase();

        if (!normalized) {
          throw createBookingValidationError('Invoice number is required.');
        }

        const repository = await getRepository();
        const booking = await repository.findByInvoiceNumber(normalized);

        if (!booking) {
          throw createBookingNotFoundError();
        }

        return booking;
      });
    },

    listBookings(query = {}) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsRead);
        const parsed = bookingListQuerySchema.safeParse(query);

        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createBookingValidationError(first?.message ?? 'Invalid list query.');
        }

        const repository = await getRepository();
        return repository.list(parsed.data);
      });
    },

    searchBookings(search, query = {}) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsRead);
        const term = search.trim();

        if (!term) {
          throw createBookingValidationError('Search term is required.');
        }

        const parsed = bookingListQuerySchema.safeParse(query);

        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createBookingValidationError(first?.message ?? 'Invalid search query.');
        }

        const repository = await getRepository();
        return repository.search(term, parsed.data);
      });
    },

    countBookings(filters = {}) {
      return fromPromise(async () => {
        await requirePerm(PERMISSIONS.bookingsRead);
        const parsed = bookingListFiltersSchema.safeParse(filters);

        if (!parsed.success) {
          const first = parsed.error.issues[0];
          throw createBookingValidationError(first?.message ?? 'Invalid booking filters.');
        }

        const repository = await getRepository();
        return repository.count(parsed.data);
      });
    },

    previewNextInvoiceNumber(issuedOn) {
      return getInvoiceService().previewNextInvoiceNumber({ issuedOn });
    },
  };

  return service;
}

/** Default request-scoped service (server client + live auth). */
export function getBookingService(): BookingService {
  return createBookingService();
}

/** Exported for rare cases where a caller needs an explicit unauthorized error. */
export { createUnauthorizedBookingAccessError };
