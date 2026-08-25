import { appConfig } from '@/config/app';

/**
 * Public contact for franchise / partnership enquiries on Book a Car.
 * Update when official franchise channels are confirmed.
 */
export const franchiseEnquiryConfig = {
  companyName: appConfig.companyName,
  email: 'partners@silvercarz.com',
  /** Set when an official franchise phone line is published. */
  phone: null as string | null,
  phoneDisplay: null as string | null,
} as const;

export type FranchiseEnquiryConfig = typeof franchiseEnquiryConfig;
