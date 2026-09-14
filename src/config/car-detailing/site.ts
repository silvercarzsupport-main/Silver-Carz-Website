import { contactConfig } from '@/config/contact';

/** Car detailing studio — business info for the public detailing page. */
export const carDetailingSite = {
  name: 'Silver Carz',
  legalName: 'Silver Carz Premium Car Detailing',
  phone: contactConfig.phoneDisplay,
  phoneHref: contactConfig.phoneHref,
  email: contactConfig.email,
  emailHref: contactConfig.emailHref,
  instagramUrl: contactConfig.instagramUrl,
  instagramHandle: contactConfig.instagramHandle,
  whatsappNumber: contactConfig.whatsappNumber,
  address: {
    street: 'Mangalmurti Square, Rajendra Nagar, Takli Seem',
    city: 'Nagpur',
    state: 'Maharashtra',
    postalCode: '440036',
    country: 'IN',
  },
  geo: { latitude: 21.1035, longitude: 79.0459 },
  hours: {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: '10:00',
    closes: '19:00',
    label: 'Mon–Sat · 10:00 AM – 7:00 PM',
  },
  serviceAreas: [
    'Rajendra Nagar',
    'Takli Seem',
    'Manish Nagar',
    'Somalwada',
    'Khamla',
    'Pratap Nagar',
    'Trimurti Nagar',
    'Wardha Road',
    'Hingna',
    'Nagpur',
  ],
} as const;

export { contactWhatsappLink as carDetailingWhatsappLink } from '@/config/contact';

const fullAddress = `Silver Carz, ${carDetailingSite.address.street}, ${carDetailingSite.address.city}, ${carDetailingSite.address.state} ${carDetailingSite.address.postalCode}`;

export const carDetailingMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  fullAddress,
)}`;

export const carDetailingMapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
  fullAddress,
)}&z=16&output=embed`;
