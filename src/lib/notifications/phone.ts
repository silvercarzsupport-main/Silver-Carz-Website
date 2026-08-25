/**
 * Indian-first E.164 helpers for WhatsApp Cloud API.
 * The Graph `to` field is digits only (no plus).
 */

const DIGITS = /[^0-9]/g;

export function digitsOnly(value: string): string {
  return value.replace(DIGITS, '');
}

/**
 * Normalizes a user-entered phone into E.164 (`+9198…`) or null.
 * Assumes India when the number is a 10-digit mobile.
 */
export function toE164Phone(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let digits = digitsOnly(trimmed);

  if (trimmed.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = `91${digits}`;
  }

  if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  if (digits.startsWith('0')) {
    return null;
  }

  return `+${digits}`;
}

/** WhatsApp Cloud API recipient: country code + number, no `+`. */
export function toWhatsAppRecipient(value: string | null | undefined): string | null {
  const e164 = toE164Phone(value);
  if (!e164) {
    return null;
  }
  return e164.slice(1);
}

export function isE164Phone(value: string | null | undefined): boolean {
  return Boolean(value && /^\+[1-9][0-9]{7,14}$/.test(value));
}
