import { digitsOnly } from '@/lib/notifications/phone';

export type VendorContactFormValues = {
  readonly name: string;
  readonly aadhaar: string;
  readonly registrationNumber: string;
  readonly chassisNumber: string;
  readonly mobile: string;
  readonly alternativeMobile: string;
  readonly permanentAddress: string;
  readonly currentAddressSame: boolean;
  readonly currentAddress: string;
};

export function formatAadhaar(value: string): string {
  const digits = digitsOnly(value).slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function formatRegistrationNumber(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

export function formatChassisNumber(value: string): string {
  return value.replace(/\s+/g, '').trim().toUpperCase();
}

export function isValidAadhaar(value: string): boolean {
  const digits = digitsOnly(value);
  return /^\d{12}$/.test(digits);
}

export function isValidIndianMobile(value: string): boolean {
  const digits = digitsOnly(value);
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(national);
}

export function isValidRegistrationNumber(value: string): boolean {
  const compact = formatRegistrationNumber(value).replace(/[\s-]/g, '');
  return compact.length >= 6 && compact.length <= 14 && /^[A-Z0-9]+$/.test(compact);
}

export function isValidChassisNumber(value: string): boolean {
  const compact = formatChassisNumber(value);
  return compact.length >= 6 && compact.length <= 17 && /^[A-Z0-9]+$/.test(compact);
}

export function buildVendorContactWhatsappMessage(values: VendorContactFormValues): string {
  const currentAddress = values.currentAddressSame
    ? 'Same as permanent address'
    : values.currentAddress.trim();

  return [
    `${values.name.trim()} — vendor vehicle enquiry`,
    '',
    `Name: ${values.name.trim()}`,
    `Aadhaar: ${formatAadhaar(values.aadhaar)}`,
    `Car registration no.: ${formatRegistrationNumber(values.registrationNumber)}`,
    `Chassis no.: ${formatChassisNumber(values.chassisNumber)}`,
    `Mobile: ${values.mobile.trim()}`,
    `Alternative mobile: ${values.alternativeMobile.trim() || '—'}`,
    `Permanent address: ${values.permanentAddress.trim()}`,
    `Current address: ${currentAddress}`,
  ].join('\n');
}
