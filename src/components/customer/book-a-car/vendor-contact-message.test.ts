import { describe, expect, it } from 'vitest';

import {
  buildVendorContactWhatsappMessage,
  formatAadhaar,
  isValidAadhaar,
  isValidChassisNumber,
  isValidIndianMobile,
  isValidRegistrationNumber,
} from '@/components/customer/book-a-car/vendor-contact-message';
import { vendorContactWhatsappLink } from '@/config/vendor-contact';

const sample = {
  name: 'Ravi Sharma',
  aadhaar: '1234 5678 9012',
  registrationNumber: 'mh31 ab 1234',
  chassisNumber: 'ma3efde1s00212345',
  mobile: '9876543210',
  alternativeMobile: '9123456789',
  permanentAddress: '12 Civil Lines, Nagpur',
  currentAddressSame: true,
  currentAddress: '',
};

describe('vendor contact WhatsApp payload', () => {
  it('formats Aadhaar and vehicle identifiers', () => {
    expect(formatAadhaar('123456789012')).toBe('1234 5678 9012');
    expect(isValidAadhaar('1234 5678 9012')).toBe(true);
    expect(isValidAadhaar('12345')).toBe(false);
    expect(isValidIndianMobile('98765 43210')).toBe(true);
    expect(isValidRegistrationNumber('MH31AB1234')).toBe(true);
    expect(isValidChassisNumber('MA3EFDE1S00212345')).toBe(true);
  });

  it('builds a WhatsApp message and wa.me link to 9028468412', () => {
    const text = buildVendorContactWhatsappMessage(sample);
    expect(text).toContain('Name: Ravi Sharma');
    expect(text).toContain('Aadhaar: 1234 5678 9012');
    expect(text).toContain('Car registration no.: MH31 AB 1234');
    expect(text).toContain('Chassis no.: MA3EFDE1S00212345');
    expect(text).toContain('Same as permanent address');

    const url = vendorContactWhatsappLink(text);
    expect(url.startsWith('https://wa.me/919028468412?text=')).toBe(true);
  });

  it('includes a separate current address when it differs', () => {
    const text = buildVendorContactWhatsappMessage({
      ...sample,
      currentAddressSame: false,
      currentAddress: 'Flat 4, Wardha Road, Nagpur',
    });
    expect(text).toContain('Current address: Flat 4, Wardha Road, Nagpur');
  });
});
