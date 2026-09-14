import { appConfig } from '@/config/app';
import { contactConfig, contactWhatsappLink } from '@/config/contact';

/**
 * Public vendor / fleet-partner enquiry on Book a Car.
 * Submit opens WhatsApp with the form details — nothing is stored in-app.
 */
export const vendorContactConfig = {
  companyName: appConfig.companyName,
  sectionId: 'vendor-contact',
  whatsappNumber: contactConfig.whatsappNumber,
  whatsappDisplay: contactConfig.phoneDisplay,
} as const;

export type VendorContactConfig = typeof vendorContactConfig;

export function vendorContactWhatsappLink(text: string): string {
  return contactWhatsappLink(text);
}
