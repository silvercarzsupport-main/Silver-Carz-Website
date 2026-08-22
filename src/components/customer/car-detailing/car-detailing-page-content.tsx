'use client';

import { DetailingCustomCursor } from '@/components/customer/car-detailing/detailing-custom-cursor';
import { DetailingSectionNav } from '@/components/customer/car-detailing/detailing-section-nav';
import { DetailingWhatsAppFloat } from '@/components/customer/car-detailing/detailing-whatsapp-float';
import { DetailingAbout } from '@/components/customer/car-detailing/sections/about';
import { DetailingContact } from '@/components/customer/car-detailing/sections/contact';
import { DetailingFaq } from '@/components/customer/car-detailing/sections/faq';
import { DetailingGallery } from '@/components/customer/car-detailing/sections/gallery';
import { DetailingHero } from '@/components/customer/car-detailing/sections/hero';
import { DetailingLocation } from '@/components/customer/car-detailing/sections/location';
import { DetailingPricing } from '@/components/customer/car-detailing/sections/pricing';
import { DetailingServices } from '@/components/customer/car-detailing/sections/services';

import '@/components/customer/car-detailing/car-detailing.css';

export function CarDetailingPageContent() {
  return (
    <div className="car-detailing-page">
      <DetailingCustomCursor />
      <DetailingSectionNav />
      <DetailingHero />
      <DetailingServices />
      <DetailingPricing />
      <DetailingLocation />
      <DetailingGallery />
      <DetailingAbout />
      <DetailingFaq />
      <DetailingContact />
      <DetailingWhatsAppFloat />
    </div>
  );
}
