/**
 * Public Silver Carz contact and socials.
 * Import from here — never hardcode phone, email, or Instagram URLs in UI.
 */
export const contactConfig = {
  phoneE164: '+919028468412',
  phoneDisplay: '+91 90284 68412',
  phoneHref: 'tel:+919028468412',
  /** wa.me recipient: country code + number, no plus. */
  whatsappNumber: '919028468412',
  email: 'silvercarzsupport@gmail.com',
  emailHref: 'mailto:silvercarzsupport@gmail.com',
  instagramUrl: 'https://www.instagram.com/silvercarzz/',
  instagramHandle: '@silvercarzz',
} as const;

export type ContactConfig = typeof contactConfig;

export function contactWhatsappLink(text: string): string {
  return `https://wa.me/${contactConfig.whatsappNumber}?text=${encodeURIComponent(text)}`;
}
