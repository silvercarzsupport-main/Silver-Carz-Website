import { carDetailingSite } from '@/config/car-detailing/site';

export const carDetailingFaqs = [
  {
    q: 'Where is Silver Carz car detailing studio located in Nagpur?',
    a: `Our studio is at ${carDetailingSite.address.street}, ${carDetailingSite.address.city}, ${carDetailingSite.address.state} ${carDetailingSite.address.postalCode}. We serve car owners across Nagpur, including Rajendra Nagar, Takli Seem, Manish Nagar, Khamla, Pratap Nagar, Trimurti Nagar, and the Wardha Road area.`,
  },
  {
    q: 'How much does a car wash cost in Nagpur at Silver Carz?',
    a: 'A basic water wash starts at just ₹200 for hatchbacks, ₹250 for sedans, and ₹300 for SUVs. A touchless shampoo wash starts at ₹350, and our full Premium Car Spa (wash, vacuum, tyre polish, interior polish and wax) starts at ₹1,200. See the full rate card above for exact prices.',
  },
  {
    q: 'Do you offer ceramic coating in Nagpur?',
    a: 'Yes — ceramic coating is one of our specialities. Pricing is ₹13,000 for hatchbacks, ₹15,000 for sedans, and ₹18,000 for SUVs and MUVs. We also do ceramic/PPF-safe shampoo washes from ₹700 to maintain coated cars.',
  },
  {
    q: 'How do I book a car detailing appointment?',
    a: `The fastest way is WhatsApp — use the booking form or the WhatsApp button on this page and we'll confirm your slot within a few hours. You can also call us directly at ${carDetailingSite.phone}.`,
  },
  {
    q: 'What are your working hours?',
    a: `We're open ${carDetailingSite.hours.label}, Monday to Saturday. Same-day express slots are available — message us on WhatsApp to check availability.`,
  },
  {
    q: 'Do you also do denting, painting, and car repairs?',
    a: 'Yes. Alongside washing and detailing, we handle denting, painting, general servicing, and repair work at the same studio — so your car can be cleaned and fixed in one visit.',
  },
] as const;
