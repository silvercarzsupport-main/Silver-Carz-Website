import { FileText, StickyNote } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/shared/empty-state';
import { PageContainer } from '@/components/shared/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ROUTES } from '@/constants/routes';
import { BookingDocumentsReview } from '@/features/booking-documents';
import {
  bookingDocumentRequirementChecklist,
  getBookingDocumentCompleteness,
} from '@/features/booking-documents/lib/completeness';
import { BookingBreadcrumb } from '@/features/bookings/components/booking-breadcrumb';
import { BookingDetailActions } from '@/features/bookings/components/booking-detail-actions';
import { BookingDetailField } from '@/features/bookings/components/booking-detail-field';
import { BookingDetailSection } from '@/features/bookings/components/booking-detail-section';
import { BookingPricingSummary } from '@/features/bookings/components/booking-pricing-summary';
import { BookingStatusBadge } from '@/features/bookings/components/booking-status-badge';
import { pricingFromBooking } from '@/features/bookings/service/pricing.service';
import {
  BOOKING_DISPLAY_STATUSES,
  getBookingStatusPresentation,
} from '@/features/bookings/service/status.service';
import { VehicleThumbnail } from '@/features/vehicles/components/vehicle-thumbnail';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import {
  BOOKING_PAYMENT_STATUS_LABELS,
  BOOKING_STATUSES,
  FUEL_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_PROVIDER_LABELS,
  RENTAL_MODE_LABELS,
  type BookingDocumentSummary,
  type BookingWithVehicle,
  type PaymentSummary,
} from '@/types';

type BookingDetailPageProps = {
  readonly booking?: BookingWithVehicle;
  readonly createdByLabel?: string | null;
  readonly customerEmail?: string | null;
  readonly documents?: readonly BookingDocumentSummary[];
  readonly payments?: readonly PaymentSummary[];
  readonly loadError?: string;
};

function formatOptionalCurrency(amount: number | null | undefined): string {
  const formatted = formatCurrency(amount);
  return formatted || '—';
}

function formatDuration(days: number | null | undefined): string {
  if (days === null || days === undefined) {
    return '—';
  }

  return days === 1 ? '1 day' : `${formatNumber(days)} days`;
}

export function BookingDetailPage({
  booking,
  createdByLabel,
  customerEmail,
  documents = [],
  payments = [],
  loadError,
}: BookingDetailPageProps) {
  if (loadError || !booking) {
    return (
      <PageContainer className="max-w-5xl">
        <div className="space-y-4">
          <BookingBreadcrumb current="Booking Details" />
        </div>

        {loadError ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Unable to load booking</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={ROUTES.bookings}>Back to Bookings</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <EmptyState
            icon={FileText}
            title="Booking not found"
            description="This booking may have been removed, or you may not have permission to view it."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.bookings}>Return to Bookings</Link>
              </Button>
            }
          />
        )}
      </PageContainer>
    );
  }

  const notes = booking.notes?.trim() ?? '';
  const rejectionReason = booking.rejection_reason?.trim() ?? '';
  const paymentMethodLabel = booking.payment_method
    ? PAYMENT_METHOD_LABELS[booking.payment_method]
    : null;
  // Pricing Engine is the display authority — never recompute money math inline.
  const pricing = pricingFromBooking(booking);
  const totalLabel = formatOptionalCurrency(pricing.grandTotal);
  const statusPresentation = getBookingStatusPresentation(booking);
  const documentCompleteness = getBookingDocumentCompleteness(
    documents.map((document) => document.documentType),
  );
  const documentsComplete = booking.document_submitted && documentCompleteness.isComplete;
  const documentsIncompleteMessage = documentsComplete
    ? null
    : `Required documents are incomplete.${
        documentCompleteness.missingLabels.length > 0
          ? ` Missing: ${documentCompleteness.missingLabels.join(', ')}.`
          : ''
      }`;
  const isDenied = booking.status === BOOKING_STATUSES.denied;
  const isScheduleBooking =
    statusPresentation.status === BOOKING_DISPLAY_STATUSES.upcoming ||
    statusPresentation.status === BOOKING_DISPLAY_STATUSES.active ||
    statusPresentation.status === BOOKING_DISPLAY_STATUSES.completed;
  const hasPaidOnline = payments.some((payment) => payment.status === 'paid');
  const hasPendingOnline = payments.some((payment) => payment.status === 'pending');
  const paymentAvailabilityLabel =
    isScheduleBooking && (Number(booking.booking_amount) > 0 || hasPaidOnline)
      ? 'Collected'
      : isScheduleBooking && hasPendingOnline
        ? 'Payment pending'
        : isScheduleBooking && Number(booking.booking_amount) <= 0
          ? 'Available'
          : isDenied
            ? 'Not payable'
            : '—';

  return (
    <PageContainer className="max-w-5xl">
      <div className="space-y-4">
        <BookingBreadcrumb current={booking.invoice_number} />

        <header className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight tabular-nums">
                  {booking.invoice_number}
                </h1>
                <BookingStatusBadge booking={booking} />
              </div>
              <p className="text-base font-medium">{booking.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                {RENTAL_MODE_LABELS[booking.mode]}
                <span className="mx-1.5 text-border" aria-hidden="true">
                  ·
                </span>
                <span className="tabular-nums">{formatDate(booking.delivery_date)}</span>
                <span className="mx-1 text-muted-foreground/70" aria-hidden="true">
                  →
                </span>
                <span className="tabular-nums">{formatDate(booking.return_date)}</span>
              </p>
              <p className="max-w-xl text-sm text-muted-foreground">
                {statusPresentation.description}
              </p>
            </div>

            <div className="shrink-0 rounded-xl border bg-muted/30 px-4 py-3 sm:min-w-[10rem] sm:text-right">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total amount
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{totalLabel}</p>
            </div>
          </div>

          <BookingDetailActions
            bookingId={booking.id}
            booking={booking}
            vehicleName={booking.vehicle.vehicle_name}
            documentsComplete={documentsComplete}
            documentsIncompleteMessage={documentsIncompleteMessage}
          />
        </header>
      </div>

      <Separator className="my-1" />

      <BookingDetailSection
        title="Booking Summary"
        description="Core booking identifiers and audit info."
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BookingDetailField label="Invoice Number" value={booking.invoice_number} />
          <BookingDetailField label="Rental Mode" value={RENTAL_MODE_LABELS[booking.mode]} />
          <BookingDetailField
            label="Status"
            value={
              <span className="inline-flex flex-col gap-1">
                <BookingStatusBadge booking={booking} />
                <span className="text-xs font-normal text-muted-foreground">
                  {statusPresentation.kind === 'lifecycle'
                    ? 'Lifecycle (automatic)'
                    : statusPresentation.kind === 'terminal'
                      ? 'Terminal'
                      : 'Draft'}
                </span>
              </span>
            }
          />
          <BookingDetailField
            label="Lifecycle"
            value={
              statusPresentation.isComputed
                ? statusPresentation.label
                : `${statusPresentation.label} (overrides lifecycle)`
            }
          />
          <BookingDetailField label="Invoice Date" value={formatDate(booking.invoice_date)} />
          <BookingDetailField label="Created Date" value={formatDateTime(booking.created_at)} />
          {createdByLabel ? <BookingDetailField label="Created By" value={createdByLabel} /> : null}
          <BookingDetailField label="Updated Date" value={formatDateTime(booking.updated_at)} />
        </dl>
      </BookingDetailSection>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <BookingDetailSection title="Customer Information">
          <dl className="grid gap-4 sm:grid-cols-2">
            <BookingDetailField label="Customer Name" value={booking.customer_name} />
            <BookingDetailField label="Email" value={customerEmail} />
            <BookingDetailField label="Contact Number" value={booking.contact_number} />
            <BookingDetailField label="Address" value={booking.address} className="sm:col-span-2" />
            <BookingDetailField label="City" value={booking.city} />
            <BookingDetailField label="State" value={booking.state} />
            <BookingDetailField label="PIN / ZIP" value={booking.zip_code} />
            <BookingDetailField
              label="Documents"
              value={
                documentsComplete
                  ? 'Complete'
                  : `${documentCompleteness.submittedCount} / ${documentCompleteness.requiredCount}`
              }
            />
          </dl>
        </BookingDetailSection>

        <BookingDetailSection title="Vehicle Information">
          <div className="mb-4 flex items-center gap-3">
            <VehicleThumbnail
              imagePath={booking.vehicle.image_path}
              alt={`${booking.vehicle.vehicle_name} photo`}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{booking.vehicle.vehicle_name}</p>
              <p className="truncate text-sm text-muted-foreground tabular-nums">
                {booking.vehicle.vehicle_number}
              </p>
            </div>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <BookingDetailField label="Vehicle Name" value={booking.vehicle.vehicle_name} />
            <BookingDetailField
              label="Vehicle Number"
              value={<span className="tabular-nums">{booking.vehicle.vehicle_number}</span>}
            />
            <BookingDetailField
              label="Fuel Type"
              value={FUEL_TYPE_LABELS[booking.vehicle.fuel_type]}
            />
            <BookingDetailField
              label="Daily Rate"
              value={
                <span className="tabular-nums">{formatOptionalCurrency(pricing.dailyRate)}</span>
              }
            />
            <BookingDetailField label="Driver Name" value={booking.driver_name} />
          </dl>
        </BookingDetailSection>

        <BookingDetailSection title="Trip Information">
          <dl className="grid gap-4 sm:grid-cols-2">
            <BookingDetailField
              label="Delivery Date"
              value={<span className="tabular-nums">{formatDate(booking.delivery_date)}</span>}
            />
            <BookingDetailField
              label="Return Date"
              value={<span className="tabular-nums">{formatDate(booking.return_date)}</span>}
            />
            <BookingDetailField label="Duration" value={formatDuration(pricing.rentalDays)} />
            <BookingDetailField label="Place To Visit" value={booking.place_to_visit} />
            <BookingDetailField label="Fuel Range" value={booking.fuel_range} />
          </dl>
        </BookingDetailSection>

        <BookingDetailSection title="Payment Information">
          <dl className="grid gap-4 sm:grid-cols-2">
            <BookingDetailField
              label="Per Day Charge"
              value={
                <span className="tabular-nums">{formatOptionalCurrency(pricing.dailyRate)}</span>
              }
            />
            <BookingDetailField
              label="Rental Charge"
              value={
                <span className="tabular-nums">{formatOptionalCurrency(pricing.rentalCharge)}</span>
              }
            />
            <BookingDetailField
              label="Booking Amount (Paid)"
              value={
                <span className="tabular-nums">{formatOptionalCurrency(pricing.amountPaid)}</span>
              }
            />
            <BookingDetailField label="Payment Method" value={paymentMethodLabel} />
            <BookingDetailField label="Payment" value={paymentAvailabilityLabel} />
            <BookingDetailField
              label="Remaining Balance"
              value={
                <span className="tabular-nums">
                  {formatOptionalCurrency(pricing.remainingBalance)}
                </span>
              }
            />
            <BookingDetailField
              label="Estimated Amount"
              value={
                <span className="font-semibold tabular-nums">
                  {formatOptionalCurrency(pricing.grandTotal)}
                </span>
              }
            />
          </dl>

          {payments.length > 0 ? (
            <div className="mt-5 border-t pt-4">
              <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Online payment attempts
              </p>
              <ul className="space-y-2">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {PAYMENT_PROVIDER_LABELS[payment.provider]} ·{' '}
                        {BOOKING_PAYMENT_STATUS_LABELS[payment.status]}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(payment.createdAt)}
                        {payment.providerOrderId ? ` · ${payment.providerOrderId}` : ''}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">
                      {formatOptionalCurrency(payment.amount)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Paid status becomes authoritative after payment verification (C7).
              </p>
            </div>
          ) : null}
        </BookingDetailSection>
      </div>

      {isDenied && rejectionReason ? (
        <BookingDetailSection
          title="Rejection reason"
          description="Shared with the customer when this request was denied."
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{rejectionReason}</p>
        </BookingDetailSection>
      ) : null}

      <BookingDetailSection
        title="Identity documents"
        description="Open uploaded files to cross-check customer identity documents."
      >
        <BookingDocumentsReview
          bookingId={booking.id}
          documents={documents}
          documentSubmitted={booking.document_submitted}
          checklist={bookingDocumentRequirementChecklist(
            documents.map((document) => document.documentType),
          )}
        />
      </BookingDetailSection>

      <BookingPricingSummary pricing={pricing} />

      <BookingDetailSection title="Notes">
        {notes ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{notes}</p>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
            <StickyNote className="size-5 text-muted-foreground" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-medium">No notes</p>
              <p className="text-sm text-muted-foreground">
                There are no notes attached to this booking.
              </p>
            </div>
          </div>
        )}
      </BookingDetailSection>

      <BookingDetailSection title="Timeline" description="Audit metadata for this booking.">
        <ol className="space-y-0" aria-label="Booking timeline">
          <li className="relative border-l-2 border-border py-1 pl-4">
            <span
              className="absolute top-2.5 -left-[5px] size-2 rounded-full bg-foreground"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">Created</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatDateTime(booking.created_at)}
            </p>
            {createdByLabel ? (
              <p className="text-sm text-muted-foreground">by {createdByLabel}</p>
            ) : null}
          </li>
          <li className="relative border-l-2 border-border py-1 pl-4">
            <span
              className="absolute top-2.5 -left-[5px] size-2 rounded-full bg-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">Last updated</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatDateTime(booking.updated_at)}
            </p>
          </li>
        </ol>
      </BookingDetailSection>
    </PageContainer>
  );
}
