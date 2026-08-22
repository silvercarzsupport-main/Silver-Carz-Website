import type { Metadata } from 'next';

import { CarDetailingPageContent } from '@/components/customer/car-detailing/car-detailing-page-content';
import { appConfig } from '@/config';
import {
  carDetailingFaqs,
  carDetailingMapsLink,
  carDetailingRateCard,
  carDetailingSite,
} from '@/config/car-detailing';

const title = 'Car Detailing | Premium Car Wash in Nagpur';
const description =
  "Nagpur's premium car detailing studio — car wash from ₹200, interior deep cleaning, ceramic coating, PPF-safe wash, denting & painting. Rajendra Nagar, Takli Seem. Book on WhatsApp or call +91 90284 68412.";

export const metadata: Metadata = {
  title: `${title} | ${appConfig.companyName}`,
  description,
  keywords: [
    'car detailing Nagpur',
    'car wash Nagpur',
    'premium car wash Nagpur',
    'ceramic coating Nagpur',
    'car spa Nagpur',
    'interior car cleaning Nagpur',
    'car polishing Nagpur',
    'PPF wash Nagpur',
    'car detailing Rajendra Nagar',
    'car wash Takli Seem',
    'car wash Wardha Road Nagpur',
    'car denting painting Nagpur',
    'engine bay cleaning Nagpur',
  ],
  openGraph: {
    type: 'website',
    title,
    description,
    images: [
      {
        url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&h=630&q=80',
        width: 1200,
        height: 630,
        alt: 'Silver Carz premium car detailing studio in Nagpur',
      },
    ],
  },
};

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': ['AutoWash', 'AutoRepair'],
  name: carDetailingSite.name,
  description,
  telephone: carDetailingSite.phone,
  priceRange: '₹200 - ₹18,000',
  currenciesAccepted: 'INR',
  address: {
    '@type': 'PostalAddress',
    streetAddress: carDetailingSite.address.street,
    addressLocality: carDetailingSite.address.city,
    addressRegion: carDetailingSite.address.state,
    postalCode: carDetailingSite.address.postalCode,
    addressCountry: carDetailingSite.address.country,
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: carDetailingSite.geo.latitude,
    longitude: carDetailingSite.geo.longitude,
  },
  hasMap: carDetailingMapsLink,
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: [...carDetailingSite.hours.days],
    opens: carDetailingSite.hours.opens,
    closes: carDetailingSite.hours.closes,
  },
  areaServed: carDetailingSite.serviceAreas.map((area) => ({
    '@type': 'Place',
    name: `${area}, Nagpur, Maharashtra`,
  })),
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Car wash & detailing rate card',
    itemListElement: carDetailingRateCard.map((row) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: row.service },
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'INR',
        minPrice: row.range[0],
        maxPrice: row.range[1],
      },
    })),
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: carDetailingFaqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function CarDetailingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <CarDetailingPageContent />
    </>
  );
}
