/** Car detailing studio — business info for the public detailing page. */
export const carDetailingSite = {
  name: 'Silver Carz',
  legalName: 'Silver Carz Premium Car Detailing',
  phone: '+91 90284 68412',
  phoneHref: 'tel:+919028468412',
  whatsappNumber: '917276038998',
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

export const carDetailingWhatsappLink = (text: string) =>
  `https://wa.me/${carDetailingSite.whatsappNumber}?text=${encodeURIComponent(text)}`;

const fullAddress = `Silver Carz, ${carDetailingSite.address.street}, ${carDetailingSite.address.city}, ${carDetailingSite.address.state} ${carDetailingSite.address.postalCode}`;

export const carDetailingMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  fullAddress,
)}`;

export const carDetailingMapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
  fullAddress,
)}&z=16&output=embed`;
