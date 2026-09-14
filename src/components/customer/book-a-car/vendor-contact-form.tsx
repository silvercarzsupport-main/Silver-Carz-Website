'use client';

import { useState, type ComponentProps, type FormEvent } from 'react';
import { MessageCircle } from 'lucide-react';

import {
  buildVendorContactWhatsappMessage,
  formatAadhaar,
  formatChassisNumber,
  formatRegistrationNumber,
  isValidAadhaar,
  isValidChassisNumber,
  isValidIndianMobile,
  isValidRegistrationNumber,
} from '@/components/customer/book-a-car/vendor-contact-message';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { vendorContactConfig, vendorContactWhatsappLink } from '@/config/vendor-contact';

type FieldErrors = Partial<
  Record<
    | 'name'
    | 'aadhaar'
    | 'registrationNumber'
    | 'chassisNumber'
    | 'mobile'
    | 'alternativeMobile'
    | 'permanentAddress'
    | 'currentAddress',
    string
  >
>;

export function VendorContactForm() {
  const [currentAddressSame, setCurrentAddressSame] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const values = {
      name: String(data.get('name') ?? '').trim(),
      aadhaar: String(data.get('aadhaar') ?? ''),
      registrationNumber: String(data.get('registrationNumber') ?? ''),
      chassisNumber: String(data.get('chassisNumber') ?? ''),
      mobile: String(data.get('mobile') ?? '').trim(),
      alternativeMobile: String(data.get('alternativeMobile') ?? '').trim(),
      permanentAddress: String(data.get('permanentAddress') ?? '').trim(),
      currentAddressSame,
      currentAddress: String(data.get('currentAddress') ?? '').trim(),
    };

    const nextErrors: FieldErrors = {};

    if (values.name.length < 2) {
      nextErrors.name = 'Enter your full name.';
    }
    if (!isValidAadhaar(values.aadhaar)) {
      nextErrors.aadhaar = 'Enter a 12-digit Aadhaar number.';
    }
    if (!isValidRegistrationNumber(values.registrationNumber)) {
      nextErrors.registrationNumber = 'Enter a valid car registration number.';
    }
    if (!isValidChassisNumber(values.chassisNumber)) {
      nextErrors.chassisNumber = 'Enter a valid chassis number.';
    }
    if (!isValidIndianMobile(values.mobile)) {
      nextErrors.mobile = 'Enter a 10-digit Indian mobile number.';
    }
    if (values.alternativeMobile && !isValidIndianMobile(values.alternativeMobile)) {
      nextErrors.alternativeMobile = 'Enter a 10-digit Indian mobile number.';
    }
    if (values.permanentAddress.length < 8) {
      nextErrors.permanentAddress = 'Enter your permanent address.';
    }
    if (!values.currentAddressSame && values.currentAddress.length < 8) {
      nextErrors.currentAddress = 'Enter your current address.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const url = vendorContactWhatsappLink(buildVendorContactWhatsappMessage(values));
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section
      id={vendorContactConfig.sectionId}
      className="scroll-mt-24 border-t border-border bg-card"
      aria-labelledby="vendor-contact-heading"
    >
      <CustomerContainer className="max-w-3xl py-10 sm:py-14">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Fleet partners
        </p>
        <h2
          id="vendor-contact-heading"
          className="mt-2 text-2xl font-bold tracking-tight text-foreground uppercase sm:text-3xl"
        >
          List your vehicle
        </h2>
        <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Share your details for challan checks. Submit opens WhatsApp to{' '}
          {vendorContactConfig.whatsappDisplay} with this information. Nothing is saved on this
          site.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <Field
            id="vendor-name"
            name="name"
            label="Name"
            autoComplete="name"
            required
            error={errors.name}
          />

          <Field
            id="vendor-aadhaar"
            name="aadhaar"
            label="Aadhaar no."
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={14}
            placeholder="XXXX XXXX XXXX"
            error={errors.aadhaar}
            onInput={(event) => {
              event.currentTarget.value = formatAadhaar(event.currentTarget.value);
            }}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="vendor-registration"
              name="registrationNumber"
              label="Car registration no."
              hint="For challan checking"
              autoComplete="off"
              required
              maxLength={14}
              placeholder="MH31 AB 1234"
              className="uppercase"
              error={errors.registrationNumber}
              onInput={(event) => {
                event.currentTarget.value = formatRegistrationNumber(event.currentTarget.value);
              }}
            />
            <Field
              id="vendor-chassis"
              name="chassisNumber"
              label="Chassis no."
              hint="For challan checking"
              autoComplete="off"
              required
              maxLength={17}
              placeholder="MA3XXXX…"
              className="uppercase"
              error={errors.chassisNumber}
              onInput={(event) => {
                event.currentTarget.value = formatChassisNumber(event.currentTarget.value);
              }}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="vendor-mobile"
              name="mobile"
              label="Mobile no."
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="98765 43210"
              error={errors.mobile}
            />
            <Field
              id="vendor-alt-mobile"
              name="alternativeMobile"
              label="Alternative mobile no."
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Optional"
              error={errors.alternativeMobile}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vendor-permanent-address">Permanent address</Label>
            <Textarea
              id="vendor-permanent-address"
              name="permanentAddress"
              required
              rows={3}
              aria-invalid={Boolean(errors.permanentAddress)}
              className="min-h-24 rounded-md"
            />
            {errors.permanentAddress ? (
              <p className="text-sm text-destructive">{errors.permanentAddress}</p>
            ) : null}
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
            <Checkbox
              id="vendor-address-same"
              checked={currentAddressSame}
              onCheckedChange={(checked) => setCurrentAddressSame(checked === true)}
              className="mt-1 size-5"
            />
            <Label
              htmlFor="vendor-address-same"
              className="block leading-relaxed font-normal text-muted-foreground"
            >
              Current address is the same as permanent address
            </Label>
          </div>

          {!currentAddressSame ? (
            <div className="grid gap-2">
              <Label htmlFor="vendor-current-address">Current address</Label>
              <Textarea
                id="vendor-current-address"
                name="currentAddress"
                required
                rows={3}
                aria-invalid={Boolean(errors.currentAddress)}
                className="min-h-24 rounded-md"
              />
              {errors.currentAddress ? (
                <p className="text-sm text-destructive">{errors.currentAddress}</p>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            className="h-11 min-w-44 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Submit on WhatsApp
          </Button>
        </form>
      </CustomerContainer>
    </section>
  );
}

function Field({
  id,
  name,
  label,
  hint,
  error,
  className,
  ...inputProps
}: ComponentProps<typeof Input> & {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {hint ? (
          <span className="font-normal text-muted-foreground"> · {hint}</span>
        ) : null}
      </Label>
      <Input
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        {...inputProps}
        className={className}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
