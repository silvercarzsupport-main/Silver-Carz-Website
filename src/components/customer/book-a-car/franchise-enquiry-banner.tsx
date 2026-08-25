import { Mail, Phone } from 'lucide-react';

import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { franchiseEnquiryConfig } from '@/config/franchise-enquiry';

export function FranchiseEnquiryBanner() {
  const { email, phone, phoneDisplay, companyName } = franchiseEnquiryConfig;
  const mailto = `mailto:${email}?subject=${encodeURIComponent(`${companyName} franchise enquiry`)}`;

  return (
    <aside
      className="border-b border-border bg-tone-gold/70 text-tone-gold-foreground"
      aria-label="Franchise enquiries"
    >
      <CustomerContainer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 text-center text-sm sm:justify-between sm:text-left">
        <p className="font-medium">
          For franchise enquiries, contact{' '}
          <a
            href={mailto}
            className="inline-flex items-center gap-1.5 font-bold underline-offset-4 hover:underline"
          >
            <Mail className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
            {email}
          </a>
          {phone && phoneDisplay ? (
            <>
              {' '}
              or{' '}
              <a
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-1.5 font-bold underline-offset-4 hover:underline"
              >
                <Phone className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
                {phoneDisplay}
              </a>
            </>
          ) : null}
          .
        </p>
      </CustomerContainer>
    </aside>
  );
}
