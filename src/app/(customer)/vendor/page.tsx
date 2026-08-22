import type { Metadata } from 'next';

import { VendorPageContent } from '@/components/customer/vendor/vendor-page-content';
import { appConfig } from '@/config';

export const metadata: Metadata = {
  title: `Vendor | ${appConfig.companyName}`,
  description: `Partner with ${appConfig.companyName} and list your fleet. Contact our partnerships team to become a vendor.`,
};

export default function VendorPage() {
  return <VendorPageContent />;
}
