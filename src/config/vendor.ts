import { appConfig } from '@/config/app';

/**
 * Public contact details for the vendor partnership page.
 * Update these when official channels are confirmed.
 */
export const vendorConfig = {
  email: 'partners@silvercarz.com',
  /** Set when the official partnerships phone line is published. */
  phone: null as string | null,
  phoneDisplay: null as string | null,
  businessHours: 'Monday – Saturday, 9:00 AM – 6:00 PM IST',
  responseTime: 'We aim to respond within 2 business days.',
  companyName: appConfig.companyName,
} as const;

export type VendorConfig = typeof vendorConfig;
