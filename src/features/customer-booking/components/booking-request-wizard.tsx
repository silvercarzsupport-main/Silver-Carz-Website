'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { BookingProgressSteps } from '@/components/customer/book-a-car/booking-progress-steps';
import { CustomerContainer } from '@/components/customer/shared/customer-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { customerBookingDocumentsPath, ROUTES } from '@/constants/routes';
import { checkCustomerBookingAvailability } from '@/features/customer-booking/actions/check-request-availability';
import { createCustomerBookingRequest } from '@/features/customer-booking/actions/create-booking-request';
import { BookingDateCalendar } from '@/features/customer-booking/components/booking-date-calendar';
import { SelectedVehicleSummary } from '@/features/customer-booking/components/selected-vehicle-summary';
import { estimateBookingTotal } from '@/features/customer-booking/lib/estimate';
import {
  clearBookingWizardDraft,
  readBookingWizardDraft,
  writeBookingWizardDraft,
  type BookingWizardDraft,
  type BookingWizardStep,
} from '@/features/customer-booking/lib/wizard-storage';
import {
  customerBookingRequestSchema,
  type CustomerBookingRequestInput,
} from '@/features/customer-booking/validations/request';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicVehicle } from '@/types';
import { RENTAL_MODE_LABELS, RENTAL_MODE_VALUES, type RentalMode } from '@/types/enums';

type WizardFormValues = CustomerBookingRequestInput;

function stepToProgress(step: BookingWizardStep): number {
  if (step === 'dates') return 2;
  if (step === 'details') return 3;
  return 3;
}

function hasCompleteDates(deliveryDate: string, returnDate: string): boolean {
  return Boolean(deliveryDate && returnDate && returnDate >= deliveryDate);
}

export function BookingRequestWizard({
  vehicle,
  initialCustomerName,
  customerEmail,
  initialStep = 'dates',
  initialCity = '',
}: {
  readonly vehicle: PublicVehicle;
  readonly initialCustomerName: string;
  readonly customerEmail: string;
  readonly initialStep?: BookingWizardStep;
  readonly initialCity?: string;
}) {
  const router = useRouter();
  const errorId = useId();
  const termsErrorId = useId();
  const [step, setStep] = useState<BookingWizardStep>(initialStep);
  const [formError, setFormError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCheckingDates, startDateCheck] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<WizardFormValues>({
    resolver: zodResolver(customerBookingRequestSchema),
    defaultValues: {
      vehicleId: vehicle.id,
      deliveryDate: '',
      returnDate: '',
      mode: 'with_driver',
      customerName: initialCustomerName,
      contactNumber: '',
      address: '',
      city: initialCity || vehicle.city || '',
      state: '',
      zipCode: '',
      placeToVisit: '',
    },
    mode: 'onSubmit',
  });

  useEffect(() => {
    const draft = readBookingWizardDraft(vehicle.id);
    if (!draft) {
      return;
    }

    reset({
      vehicleId: vehicle.id,
      deliveryDate: draft.deliveryDate ?? '',
      returnDate: draft.returnDate ?? '',
      mode: draft.mode ?? 'with_driver',
      customerName: draft.customerName || initialCustomerName,
      contactNumber: draft.contactNumber ?? '',
      address: draft.address ?? '',
      city: draft.city || initialCity || vehicle.city || '',
      state: draft.state ?? '',
      zipCode: draft.zipCode ?? '',
      placeToVisit: draft.placeToVisit ?? '',
    });
  }, [vehicle.id, vehicle.city, initialCustomerName, initialCity, reset]);

  const deliveryDate = useWatch({ control, name: 'deliveryDate' }) ?? '';
  const returnDate = useWatch({ control, name: 'returnDate' }) ?? '';
  const visibleStep: BookingWizardStep =
    (step === 'details' || step === 'review') && !hasCompleteDates(deliveryDate, returnDate)
      ? 'dates'
      : step;
  const mode = useWatch({ control, name: 'mode' }) ?? 'with_driver';
  const customerName = useWatch({ control, name: 'customerName' }) ?? '';
  const contactNumber = useWatch({ control, name: 'contactNumber' }) ?? '';
  const address = useWatch({ control, name: 'address' }) ?? '';
  const city = useWatch({ control, name: 'city' }) ?? '';
  const state = useWatch({ control, name: 'state' }) ?? '';
  const zipCode = useWatch({ control, name: 'zipCode' }) ?? '';
  const placeToVisit = useWatch({ control, name: 'placeToVisit' }) ?? '';

  const estimate = estimateBookingTotal({
    dailyRate: Number(vehicle.default_daily_rate),
    deliveryDate,
    returnDate,
  });

  const isLoading = isSubmitting || isPending;

  const persistDraft = () => {
    const values = getValues();
    const draft: BookingWizardDraft = {
      deliveryDate: values.deliveryDate,
      returnDate: values.returnDate,
      mode: values.mode,
      customerName: values.customerName,
      contactNumber: values.contactNumber,
      address: values.address,
      city: values.city,
      state: values.state,
      zipCode: values.zipCode,
      placeToVisit: values.placeToVisit ?? '',
    };
    writeBookingWizardDraft(vehicle.id, draft);
  };

  const persistStepInUrl = (next: BookingWizardStep) => {
    const params = new URLSearchParams({ vehicle: vehicle.id, step: next });
    router.replace(`${ROUTES.bookingContinue}?${params.toString()}`, { scroll: false });
  };

  const goToStep = (next: BookingWizardStep) => {
    persistDraft();
    setFormError(null);
    setStep(next);
    persistStepInUrl(next);
  };

  const onContinueFromDates = () => {
    setFormError(null);
    startDateCheck(async () => {
      const values = getValues();

      if (!values.deliveryDate || !values.returnDate) {
        setFormError('Select both a pickup date and a return date on the calendar.');
        return;
      }

      const datesOk = await trigger(['deliveryDate', 'returnDate', 'mode']);
      if (!datesOk) {
        return;
      }

      const result = await checkCustomerBookingAvailability({
        vehicleId: vehicle.id,
        deliveryDate: values.deliveryDate,
        returnDate: values.returnDate,
      });

      if (!result.success) {
        setFormError(result.error.message);
        return;
      }

      goToStep('details');
    });
  };

  const onContinueFromDetails = async () => {
    setFormError(null);
    const ok = await trigger([
      'customerName',
      'contactNumber',
      'address',
      'city',
      'state',
      'zipCode',
      'placeToVisit',
    ]);
    if (!ok) {
      return;
    }
    goToStep('review');
  };

  const onSubmitRequest = handleSubmit((values) => {
    setFormError(null);

    // Terms & Conditions acknowledgement is required before a request is sent.
    if (!termsAccepted) {
      setTermsError(true);
      return;
    }

    startTransition(async () => {
      const result = await createCustomerBookingRequest(values);

      if (!result.success) {
        setFormError(result.error.message);
        return;
      }

      clearBookingWizardDraft(vehicle.id);
      router.push(customerBookingDocumentsPath(result.data.id));
    });
  });

  return (
    <>
      <BookingProgressSteps activeStep={stepToProgress(visibleStep)} />

      <CustomerContainer className="max-w-5xl py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Booking ·{' '}
              {visibleStep === 'dates'
                ? 'Select dates'
                : visibleStep === 'details'
                  ? 'Your details'
                  : 'Review'}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
              {visibleStep === 'dates'
                ? 'Select dates'
                : visibleStep === 'details'
                  ? 'Your details'
                  : 'Review request'}
            </h1>
            <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {visibleStep === 'dates'
                ? 'Pick your dates on the calendar. Unavailable days are marked in red. As per company policy, one 24-hour cycle starts from midnight 12 to next day midnight 12.'
                : visibleStep === 'details'
                  ? 'Confirm how we can reach you for this rental request. The hirer must be 20 or above and hold a driving licence.'
                  : 'Check everything carefully, then send your request for Silver Carz approval.'}
            </p>

            {formError ? (
              <Alert variant="destructive" className="mt-6" id={errorId}>
                <AlertTitle>Unable to continue</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <form
              onSubmit={onSubmitRequest}
              noValidate
              className="mt-8 space-y-6"
              aria-describedby={formError ? errorId : undefined}
            >
              <input type="hidden" {...register('vehicleId')} />

              {visibleStep === 'dates' ? (
                <div className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-6">
                  <input type="hidden" {...register('deliveryDate')} />
                  <input type="hidden" {...register('returnDate')} />

                  <div className="space-y-2">
                    <Label>Select rental dates</Label>
                    <p className="text-sm text-muted-foreground">
                      Tap your pickup date, then your return date. Red boxes are already booked.
                    </p>
                    <BookingDateCalendar
                      vehicleId={vehicle.id}
                      deliveryDate={deliveryDate}
                      returnDate={returnDate}
                      disabled={isCheckingDates || isLoading}
                      onChange={({ deliveryDate: nextDelivery, returnDate: nextReturn }) => {
                        setValue('deliveryDate', nextDelivery, { shouldValidate: true });
                        setValue('returnDate', nextReturn, { shouldValidate: true });
                      }}
                      onSelectionIssue={(message) => setFormError(message)}
                    />
                    {errors.deliveryDate ? (
                      <p className="text-sm text-destructive">{errors.deliveryDate.message}</p>
                    ) : null}
                    {errors.returnDate ? (
                      <p className="text-sm text-destructive">{errors.returnDate.message}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="mode">Mode</Label>
                    <Select
                      value={mode}
                      onValueChange={(value) =>
                        setValue('mode', value as RentalMode, { shouldValidate: true })
                      }
                      disabled={isCheckingDates || isLoading}
                    >
                      <SelectTrigger id="mode" className="w-full">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {RENTAL_MODE_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {RENTAL_MODE_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.mode ? (
                      <p className="text-sm text-destructive">{errors.mode.message}</p>
                    ) : null}
                  </div>

                  {estimate.rentalDays > 0 ? (
                    <dl className="grid gap-3 rounded-md bg-muted/60 px-4 py-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Pickup</dt>
                        <dd className="font-semibold text-foreground">
                          {formatDate(deliveryDate) || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Return</dt>
                        <dd className="font-semibold text-foreground">
                          {formatDate(returnDate) || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Duration</dt>
                        <dd className="font-semibold text-foreground">
                          {estimate.rentalDays} {estimate.rentalDays === 1 ? 'day' : 'days'}
                        </dd>
                      </div>
                    </dl>
                  ) : null}

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={onContinueFromDates}
                      disabled={isCheckingDates || isLoading}
                      className="h-11 min-w-[10rem] rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
                    >
                      {isCheckingDates ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          Checking…
                        </>
                      ) : (
                        'Continue'
                      )}
                    </Button>
                    <Button asChild type="button" variant="outline" className="h-11 rounded-md">
                      <Link href={`/?vehicle=${vehicle.id}`}>Change car</Link>
                    </Button>
                  </div>
                </div>
              ) : null}

              {visibleStep === 'details' ? (
                <div className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-6">
                  <div className="grid gap-2">
                    <Label htmlFor="customerName">Full name</Label>
                    <Input
                      id="customerName"
                      autoComplete="name"
                      disabled={isLoading}
                      aria-invalid={Boolean(errors.customerName)}
                      {...register('customerName')}
                    />
                    {errors.customerName ? (
                      <p className="text-sm text-destructive">{errors.customerName.message}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="customerEmail">Email</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      readOnly
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      From your account. Contact number below is used for this request.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="contactNumber">Contact number</Label>
                    <Input
                      id="contactNumber"
                      type="tel"
                      autoComplete="tel"
                      disabled={isLoading}
                      aria-invalid={Boolean(errors.contactNumber)}
                      {...register('contactNumber')}
                    />
                    {errors.contactNumber ? (
                      <p className="text-sm text-destructive">{errors.contactNumber.message}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      autoComplete="street-address"
                      disabled={isLoading}
                      aria-invalid={Boolean(errors.address)}
                      {...register('address')}
                    />
                    {errors.address ? (
                      <p className="text-sm text-destructive">{errors.address.message}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        autoComplete="address-level2"
                        disabled={isLoading}
                        aria-invalid={Boolean(errors.city)}
                        {...register('city')}
                      />
                      {errors.city ? (
                        <p className="text-sm text-destructive">{errors.city.message}</p>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        autoComplete="address-level1"
                        disabled={isLoading}
                        aria-invalid={Boolean(errors.state)}
                        {...register('state')}
                      />
                      {errors.state ? (
                        <p className="text-sm text-destructive">{errors.state.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="zipCode">PIN code</Label>
                      <Input
                        id="zipCode"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        disabled={isLoading}
                        aria-invalid={Boolean(errors.zipCode)}
                        {...register('zipCode')}
                      />
                      {errors.zipCode ? (
                        <p className="text-sm text-destructive">{errors.zipCode.message}</p>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="placeToVisit">Place to visit</Label>
                      <Input
                        id="placeToVisit"
                        disabled={isLoading}
                        aria-invalid={Boolean(errors.placeToVisit)}
                        {...register('placeToVisit')}
                      />
                      {errors.placeToVisit ? (
                        <p className="text-sm text-destructive">{errors.placeToVisit.message}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={onContinueFromDetails}
                      disabled={isLoading}
                      className="h-11 min-w-[10rem] rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
                    >
                      Review request
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-md"
                      onClick={() => goToStep('dates')}
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              ) : null}

              {visibleStep === 'review' ? (
                <div className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-6">
                  <SelectedVehicleSummary vehicle={vehicle} />

                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <ReviewField label="Pickup" value={formatDate(deliveryDate)} />
                    <ReviewField label="Return" value={formatDate(returnDate)} />
                    <ReviewField
                      label="Duration"
                      value={`${estimate.rentalDays} ${estimate.rentalDays === 1 ? 'day' : 'days'}`}
                    />
                    <ReviewField label="Mode" value={RENTAL_MODE_LABELS[mode]} />
                    <ReviewField label="Full name" value={customerName} />
                    <ReviewField label="Email" value={customerEmail} />
                    <ReviewField label="Contact" value={contactNumber} />
                    <ReviewField label="PIN code" value={zipCode} />
                    <ReviewField
                      label="Address"
                      value={[address, city, state].filter(Boolean).join(', ')}
                      className="sm:col-span-2"
                    />
                    <ReviewField
                      label="Place to visit"
                      value={placeToVisit || '—'}
                      className="sm:col-span-2"
                    />
                    <ReviewField
                      label="Estimated total"
                      value={formatCurrency(estimate.estimatedTotal, {
                        maximumFractionDigits: 0,
                      })}
                      className="sm:col-span-2"
                      emphasize
                    />
                  </dl>

                  <p className="text-xs text-muted-foreground">
                    Submitting sends a booking request for admin approval. It does not confirm the
                    hire or complete payment.
                  </p>

                  <div className="space-y-2 rounded-md border border-border bg-muted/40 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms-ack"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => {
                          setTermsAccepted(checked === true);
                          if (checked) {
                            setTermsError(false);
                          }
                        }}
                        disabled={isLoading}
                        aria-required="true"
                        aria-invalid={termsError ? true : undefined}
                        aria-describedby={termsError ? termsErrorId : undefined}
                        className="mt-1 size-5"
                      />
                      <Label
                        htmlFor="terms-ack"
                        className="block min-w-0 items-start leading-relaxed font-normal whitespace-normal text-muted-foreground"
                      >
                        I have read and agree to the Silver Carz{' '}
                        <Link
                          href={`${ROUTES.aboutUs}#terms`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-foreground underline underline-offset-4 hover:text-primary"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Terms & Conditions
                        </Link>
                        .
                      </Label>
                    </div>
                    {termsError ? (
                      <p id={termsErrorId} className="text-sm text-destructive" role="alert">
                        Please accept the Terms & Conditions to submit your request.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="h-11 min-w-[12rem] rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          Submitting…
                        </>
                      ) : (
                        'Request booking'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-md"
                      onClick={() => goToStep('details')}
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              ) : null}
            </form>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="bg-secondary px-4 py-3">
                <h2 className="text-sm font-bold tracking-wide text-secondary-foreground uppercase">
                  Booking summary
                </h2>
              </div>
              <div className="space-y-4 p-4">
                <SelectedVehicleSummary vehicle={vehicle} compact />
                <div className="space-y-2 border-t border-border pt-4 text-sm">
                  <SummaryRow label="Pickup" value={formatDate(deliveryDate) || '—'} />
                  <SummaryRow label="Return" value={formatDate(returnDate) || '—'} />
                  <SummaryRow
                    label="Duration"
                    value={
                      estimate.rentalDays > 0
                        ? `${estimate.rentalDays} ${estimate.rentalDays === 1 ? 'day' : 'days'}`
                        : '—'
                    }
                  />
                  <SummaryRow label="Mode" value={RENTAL_MODE_LABELS[mode]} />
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-muted-foreground">Estimated total</span>
                    <span className="font-bold text-foreground">
                      {estimate.rentalDays > 0
                        ? formatCurrency(estimate.estimatedTotal, { maximumFractionDigits: 0 })
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </CustomerContainer>
    </>
  );
}

function SummaryRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ReviewField({
  label,
  value,
  className,
  emphasize = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly className?: string;
  readonly emphasize?: boolean;
}) {
  return (
    <div className={cn(className)}>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={cn('mt-1 text-foreground', emphasize ? 'text-lg font-bold' : 'font-semibold')}>
        {value}
      </dd>
    </div>
  );
}
