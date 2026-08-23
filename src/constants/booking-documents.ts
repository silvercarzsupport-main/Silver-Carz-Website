/**
 * Customer booking document requirements and Storage constraints (C4).
 *
 * Keep MIME / size / type rules here so UI, validations, and Storage stay aligned.
 * Do not hardcode document requirements in components.
 */

export const BOOKING_DOCUMENT_TYPES = {
  drivingLicense: 'driving_license',
  governmentId: 'government_id',
  addressProof: 'address_proof',
} as const;

export type BookingDocumentType =
  (typeof BOOKING_DOCUMENT_TYPES)[keyof typeof BOOKING_DOCUMENT_TYPES];

export const BOOKING_DOCUMENT_TYPE_VALUES = [
  BOOKING_DOCUMENT_TYPES.drivingLicense,
  BOOKING_DOCUMENT_TYPES.governmentId,
  BOOKING_DOCUMENT_TYPES.addressProof,
] as const satisfies readonly BookingDocumentType[];

export type BookingDocumentRequirement = {
  readonly type: BookingDocumentType;
  readonly label: string;
  readonly description: string;
  readonly required: boolean;
};

/**
 * Minimal required set for Silver Carz rental requests (India).
 * Admin approval / rejection of individual files belongs to a later phase.
 */
export const BOOKING_DOCUMENT_REQUIREMENTS: readonly BookingDocumentRequirement[] = [
  {
    type: BOOKING_DOCUMENT_TYPES.drivingLicense,
    label: 'Driving License',
    description:
      'Copy of a valid driving licence (front and back if combined). A driving licence is compulsory.',
    required: true,
  },
  {
    type: BOOKING_DOCUMENT_TYPES.governmentId,
    label: 'Aadhaar',
    description:
      'Copy of Aadhaar. The original Aadhaar card is submitted to the company at handover and returned at the end of the booking.',
    required: true,
  },
  {
    type: BOOKING_DOCUMENT_TYPES.addressProof,
    label: 'Address Proof',
    description: 'Copy of address proof.',
    required: true,
  },
] as const;

export const BOOKING_DOCUMENT = {
  /** Private Supabase Storage bucket (see booking_documents migration). */
  bucket: 'booking-documents',
  maxBytes: 5 * 1024 * 1024,
  acceptMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'] as const,
  acceptAttribute: 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png',
  /** Short-lived signed URL TTL for private previews (seconds). */
  signedUrlExpiresIn: 120,
} as const;

export type BookingDocumentMimeType = (typeof BOOKING_DOCUMENT.acceptMimeTypes)[number];

export function isBookingDocumentType(value: string): value is BookingDocumentType {
  return (BOOKING_DOCUMENT_TYPE_VALUES as readonly string[]).includes(value);
}

export function requiredBookingDocumentTypes(): readonly BookingDocumentType[] {
  return BOOKING_DOCUMENT_REQUIREMENTS.filter((item) => item.required).map((item) => item.type);
}

export function bookingDocumentLabel(type: BookingDocumentType): string {
  return BOOKING_DOCUMENT_REQUIREMENTS.find((item) => item.type === type)?.label ?? type;
}
