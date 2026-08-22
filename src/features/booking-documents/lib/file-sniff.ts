/**
 * Magic-byte sniffing for booking documents.
 * `File.type` is attacker-controlled; the first bytes are not.
 */

export type SniffedBookingDocumentMime = 'application/pdf' | 'image/jpeg' | 'image/png';

export function sniffBookingDocumentMime(bytes: Uint8Array): SniffedBookingDocumentMime | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'application/pdf';
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  return null;
}

export function claimedMimeMatchesSniff(
  claimedMime: string,
  sniffed: SniffedBookingDocumentMime,
): boolean {
  const claimed = claimedMime.trim().toLowerCase();
  if (!claimed) {
    return true;
  }

  if (sniffed === 'image/jpeg') {
    return claimed === 'image/jpeg' || claimed === 'image/jpg';
  }

  return claimed === sniffed;
}
