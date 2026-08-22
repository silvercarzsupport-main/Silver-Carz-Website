/**
 * Private booking-document Storage helpers.
 *
 * Never construct object paths from raw user filenames.
 * Never return permanent public URLs.
 */

import 'server-only';

import { BOOKING_DOCUMENT, type BookingDocumentType } from '@/constants/booking-documents';
import {
  createBookingDocumentStorageFailureError,
  createBookingDocumentValidationError,
} from '@/features/booking-documents/errors';
import {
  claimedMimeMatchesSniff,
  sniffBookingDocumentMime,
  type SniffedBookingDocumentMime,
} from '@/features/booking-documents/lib/file-sniff';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function validateBookingDocumentFile(file: File): Promise<SniffedBookingDocumentMime> {
  if (file.size <= 0) {
    throw createBookingDocumentValidationError('The selected file is empty.');
  }

  if (file.size > BOOKING_DOCUMENT.maxBytes) {
    throw createBookingDocumentValidationError('File must be 5 MB or smaller.');
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffBookingDocumentMime(header);

  if (!sniffed) {
    throw createBookingDocumentValidationError('Use a PDF, JPG, or PNG file.');
  }

  if (!claimedMimeMatchesSniff(file.type, sniffed)) {
    throw createBookingDocumentValidationError('The file type does not match the selected file.');
  }

  return sniffed;
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'jpg';
  }
}

/**
 * Controlled Storage path:
 *   {customerId}/{bookingId}/{documentType}-{uuid}.{ext}
 */
export function buildBookingDocumentObjectPath(params: {
  readonly customerId: string;
  readonly bookingId: string;
  readonly documentType: BookingDocumentType;
  readonly mimeType: string;
}): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${params.customerId}/${params.bookingId}/${params.documentType}-${uuid}.${extensionForMime(params.mimeType)}`;
}

export async function uploadBookingDocumentObject(params: {
  readonly path: string;
  readonly file: File;
  readonly contentType: string;
  readonly client?: TypedSupabaseClient;
}): Promise<void> {
  const client = params.client ?? (await createSupabaseServerClient());
  const { error } = await client.storage
    .from(BOOKING_DOCUMENT.bucket)
    .upload(params.path, params.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: params.contentType,
    });

  if (error) {
    throw createBookingDocumentStorageFailureError(
      'Unable to upload the document. Please try again.',
      error,
    );
  }
}

export async function removeBookingDocumentObject(params: {
  readonly path: string | null | undefined;
  readonly client?: TypedSupabaseClient;
}): Promise<void> {
  const path = params.path?.trim();
  if (!path) {
    return;
  }

  const client = params.client ?? (await createSupabaseServerClient());
  const { error } = await client.storage.from(BOOKING_DOCUMENT.bucket).remove([path]);

  if (error) {
    throw createBookingDocumentStorageFailureError(
      'Unable to remove the previous document. Please try again.',
      error,
    );
  }
}

export async function createBookingDocumentSignedUrl(params: {
  readonly path: string;
  readonly expiresIn?: number;
  readonly client?: TypedSupabaseClient;
}): Promise<string> {
  const path = params.path.trim();
  if (!path) {
    throw createBookingDocumentValidationError('Document path is required.');
  }

  const client = params.client ?? (await createSupabaseServerClient());
  const { data, error } = await client.storage
    .from(BOOKING_DOCUMENT.bucket)
    .createSignedUrl(path, params.expiresIn ?? BOOKING_DOCUMENT.signedUrlExpiresIn);

  if (error || !data?.signedUrl) {
    throw createBookingDocumentStorageFailureError(
      'Unable to open the document. Please try again.',
      error,
    );
  }

  return data.signedUrl;
}
