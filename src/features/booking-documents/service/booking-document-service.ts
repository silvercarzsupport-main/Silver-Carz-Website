/**
 * Booking document service (C4).
 *
 * Upload ordering:
 * 1. Validate ownership + eligibility
 * 2. Validate file
 * 3. Upload to private Storage
 * 4. Create/update metadata
 * 5. On metadata failure, remove uploaded object
 *
 * Replacement: upload new → update metadata → remove old object.
 */

import 'server-only';

import {
  BOOKING_DOCUMENT_TYPE_VALUES,
  isBookingDocumentType,
  requiredBookingDocumentTypes,
  type BookingDocumentType,
} from '@/constants/booking-documents';
import {
  createBookingDocumentIneligibleError,
  createBookingDocumentMissingRequiredError,
  createBookingDocumentNotFoundError,
  createBookingDocumentUnauthorizedError,
  createBookingDocumentValidationError,
} from '@/features/booking-documents/errors';
import {
  buildBookingDocumentObjectPath,
  createBookingDocumentSignedUrl,
  removeBookingDocumentObject,
  uploadBookingDocumentObject,
  validateBookingDocumentFile,
} from '@/features/booking-documents/lib/storage';
import {
  createBookingDocumentRepository,
  getBookingDocumentRepository,
  type BookingDocumentRepository,
} from '@/features/booking-documents/repository/booking-document-repository';
import {
  createBookingNotFoundError,
  createBookingValidationError,
  createUnauthorizedBookingAccessError,
} from '@/features/bookings/errors';
import {
  createBookingRepository,
  getBookingRepository,
  type BookingRepository,
} from '@/features/bookings/repository';
import { APP_ROLES, isStaff, requireUser, type AuthUser } from '@/lib/auth';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fromPromise } from '@/services';
import type { ApiResponse, Booking, BookingDocumentSummary } from '@/types';
import { toBookingDocumentSummary } from '@/types/booking-document';
import { BOOKING_STATUSES } from '@/types/enums';

export interface BookingDocumentServiceDeps {
  readonly documentRepository?: BookingDocumentRepository;
  readonly bookingRepository?: BookingRepository;
  readonly client?: TypedSupabaseClient;
  readonly requireUser?: typeof requireUser;
}

export interface BookingDocumentService {
  listOwnDocuments(bookingId: string): Promise<ApiResponse<BookingDocumentSummary[]>>;
  uploadOwnDocument(input: {
    readonly bookingId: string;
    readonly documentType: string;
    readonly file: File;
  }): Promise<ApiResponse<BookingDocumentSummary>>;
  deleteOwnDocument(input: {
    readonly bookingId: string;
    readonly documentType: string;
  }): Promise<ApiResponse<{ readonly deleted: true }>>;
  submitOwnDocuments(bookingId: string): Promise<ApiResponse<Booking>>;
  getOwnDocumentSignedUrl(input: {
    readonly bookingId: string;
    readonly documentType: string;
  }): Promise<ApiResponse<{ readonly url: string }>>;
  listDocumentsForStaff(bookingId: string): Promise<ApiResponse<BookingDocumentSummary[]>>;
  getStaffDocumentSignedUrl(input: {
    readonly bookingId: string;
    readonly documentId: string;
  }): Promise<
    ApiResponse<{ readonly url: string; readonly mimeType: string; readonly fileName: string }>
  >;
}

function assertCustomerActor(actor: AuthUser): void {
  if (actor.role !== APP_ROLES.customer) {
    throw createUnauthorizedBookingAccessError();
  }
}

function assertStaffActor(actor: AuthUser): void {
  if (!isStaff(actor)) {
    throw createBookingDocumentUnauthorizedError();
  }
}

function parseDocumentType(value: string): BookingDocumentType {
  if (!isBookingDocumentType(value)) {
    throw createBookingDocumentValidationError('Unknown document type.');
  }
  return value;
}

function sanitizeOriginalFileName(name: string): string {
  const trimmed = name.trim().replace(/[/\\]/g, '').slice(0, 180);
  return trimmed || 'document';
}

export function createBookingDocumentService(
  deps: BookingDocumentServiceDeps = {},
): BookingDocumentService {
  const requireActor = deps.requireUser ?? requireUser;

  async function getClient(): Promise<TypedSupabaseClient> {
    return deps.client ?? (await createSupabaseServerClient());
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

  async function getBookings(): Promise<BookingRepository> {
    if (deps.bookingRepository) {
      return deps.bookingRepository;
    }
    if (deps.client) {
      return createBookingRepository(deps.client);
    }
    return getBookingRepository();
  }

  async function loadOwnedEligibleBooking(
    actor: AuthUser,
    bookingId: string,
    options?: { readonly allowSubmitted?: boolean },
  ): Promise<Booking> {
    if (!bookingId.trim()) {
      throw createBookingValidationError('Booking id is required.');
    }

    const bookings = await getBookings();
    const booking = await bookings.findById(bookingId);

    if (!booking || booking.created_by !== actor.id) {
      throw createBookingNotFoundError();
    }

    if (booking.status !== BOOKING_STATUSES.draft) {
      throw createBookingDocumentIneligibleError(
        'Documents can only be managed for pending booking requests.',
      );
    }

    if (booking.document_submitted && !options?.allowSubmitted) {
      throw createBookingDocumentIneligibleError(
        'Documents have already been submitted for this booking request.',
      );
    }

    return booking;
  }

  const service: BookingDocumentService = {
    listOwnDocuments(bookingId) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        // Allow listing after submit so the customer can see what was sent.
        await loadOwnedEligibleBooking(actor, bookingId, { allowSubmitted: true });

        const documents = await getDocuments();
        const rows = await documents.listForBooking(bookingId);
        return rows
          .filter((row) => row.customer_id === actor.id)
          .map((row) => toBookingDocumentSummary(row));
      });
    },

    uploadOwnDocument(input) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        const documentType = parseDocumentType(input.documentType);
        const booking = await loadOwnedEligibleBooking(actor, input.bookingId);
        const mimeType = await validateBookingDocumentFile(input.file);

        const client = await getClient();
        const documents = await getDocuments();
        const existing = await documents.findByBookingAndType(booking.id, documentType);

        const nextPath = buildBookingDocumentObjectPath({
          customerId: actor.id,
          bookingId: booking.id,
          documentType,
          mimeType,
        });

        await uploadBookingDocumentObject({
          path: nextPath,
          file: input.file,
          contentType: mimeType,
          client,
        });

        const metadata = {
          booking_id: booking.id,
          customer_id: actor.id,
          document_type: documentType,
          file_name: sanitizeOriginalFileName(input.file.name),
          storage_path: nextPath,
          mime_type: mimeType,
          file_size: input.file.size,
        };

        try {
          if (existing) {
            const updated = await documents.update(existing.id, metadata);
            if (existing.storage_path !== nextPath) {
              try {
                await removeBookingDocumentObject({
                  path: existing.storage_path,
                  client,
                });
              } catch {
                // Replacement already succeeded — orphan cleanup best-effort.
              }
            }
            return toBookingDocumentSummary(updated);
          }

          const created = await documents.create(metadata);
          return toBookingDocumentSummary(created);
        } catch (error) {
          try {
            await removeBookingDocumentObject({ path: nextPath, client });
          } catch {
            // Prefer surfacing the original metadata failure.
          }
          throw error;
        }
      });
    },

    deleteOwnDocument(input) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        const documentType = parseDocumentType(input.documentType);
        await loadOwnedEligibleBooking(actor, input.bookingId);

        const client = await getClient();
        const documents = await getDocuments();
        const existing = await documents.findByBookingAndType(input.bookingId, documentType);

        if (!existing || existing.customer_id !== actor.id) {
          throw createBookingDocumentNotFoundError();
        }

        await documents.delete(existing.id);

        try {
          await removeBookingDocumentObject({ path: existing.storage_path, client });
        } catch {
          // Metadata already removed — orphan cleanup best-effort.
        }

        return { deleted: true as const };
      });
    },

    submitOwnDocuments(bookingId) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        const booking = await loadOwnedEligibleBooking(actor, bookingId, {
          allowSubmitted: true,
        });

        if (booking.document_submitted) {
          return booking;
        }

        const documents = await getDocuments();
        const rows = await documents.listForBooking(booking.id);
        const uploadedTypes = new Set(
          rows.filter((row) => row.customer_id === actor.id).map((row) => row.document_type),
        );

        const missing = requiredBookingDocumentTypes().filter((type) => !uploadedTypes.has(type));
        if (missing.length > 0) {
          throw createBookingDocumentMissingRequiredError();
        }

        // Guard against unexpected types sneaking past the unique constraint.
        for (const row of rows) {
          if (!(BOOKING_DOCUMENT_TYPE_VALUES as readonly string[]).includes(row.document_type)) {
            throw createBookingDocumentValidationError('Invalid document metadata.');
          }
        }

        const client = await getClient();
        const { data, error } = await client.rpc('mark_booking_documents_submitted', {
          p_booking_id: booking.id,
        });

        if (error) {
          if (error.message?.includes('required documents')) {
            throw createBookingDocumentMissingRequiredError();
          }
          throw createBookingDocumentIneligibleError(
            'Unable to submit documents for this booking request.',
          );
        }

        if (!data) {
          throw createBookingDocumentIneligibleError(
            'Unable to submit documents for this booking request.',
          );
        }

        return data;
      });
    },

    getOwnDocumentSignedUrl(input) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertCustomerActor(actor);

        const documentType = parseDocumentType(input.documentType);
        await loadOwnedEligibleBooking(actor, input.bookingId, { allowSubmitted: true });

        const documents = await getDocuments();
        const existing = await documents.findByBookingAndType(input.bookingId, documentType);

        if (!existing || existing.customer_id !== actor.id) {
          throw createBookingDocumentNotFoundError();
        }

        // Extra path ownership guard — folder must start with customer id.
        if (!existing.storage_path.startsWith(`${actor.id}/`)) {
          throw createBookingDocumentUnauthorizedError();
        }

        const client = await getClient();
        const url = await createBookingDocumentSignedUrl({
          path: existing.storage_path,
          client,
        });

        return { url };
      });
    },

    listDocumentsForStaff(bookingId) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertStaffActor(actor);

        if (!bookingId.trim()) {
          throw createBookingValidationError('Booking id is required.');
        }

        const bookings = await getBookings();
        const booking = await bookings.findById(bookingId);
        if (!booking) {
          throw createBookingNotFoundError();
        }

        const documents = await getDocuments();
        const rows = await documents.listForBooking(bookingId);
        return rows.map((row) => toBookingDocumentSummary(row));
      });
    },

    getStaffDocumentSignedUrl(input) {
      return fromPromise(async () => {
        const actor = await requireActor();
        assertStaffActor(actor);

        if (!input.bookingId.trim() || !input.documentId.trim()) {
          throw createBookingDocumentValidationError('Document id is required.');
        }

        const documents = await getDocuments();
        const existing = await documents.findById(input.documentId);

        if (!existing || existing.booking_id !== input.bookingId) {
          throw createBookingDocumentNotFoundError();
        }

        const client = await getClient();
        const url = await createBookingDocumentSignedUrl({
          path: existing.storage_path,
          client,
        });

        return {
          url,
          mimeType: existing.mime_type,
          fileName: existing.file_name,
        };
      });
    },
  };

  return service;
}

let singleton: BookingDocumentService | null = null;

export function getBookingDocumentService(): BookingDocumentService {
  if (!singleton) {
    singleton = createBookingDocumentService();
  }
  return singleton;
}
