import { ChevronDown } from 'lucide-react';

import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { vendorContactConfig } from '@/config/vendor-contact';

export function FranchiseEnquiryBanner() {
  return (
    <aside
      className="border-b border-border bg-tone-gold/70 text-tone-gold-foreground"
      aria-label="Vendor vehicle listing"
    >
      <CustomerContainer className="flex flex-wrap items-center justify-center gap-3 py-2.5 text-center sm:justify-between sm:text-left">
        <p className="text-sm font-medium">
          Want to list your car with {vendorContactConfig.companyName}?
        </p>
        <a
          href={`#${vendorContactConfig.sectionId}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-secondary px-3 text-xs font-bold tracking-wide text-secondary-foreground uppercase hover:bg-secondary/90"
        >
          Vendor enquiry
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </a>
      </CustomerContainer>
    </aside>
  );
}
