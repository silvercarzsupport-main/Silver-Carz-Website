'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  BOOKING_DOCUMENT_REQUIREMENTS,
  requiredBookingDocumentTypes,
  type BookingDocumentType,
} from '@/constants/booking-documents';
import { customerBookingPath } from '@/constants/routes';
import { submitOwnBookingDocuments } from '@/features/booking-documents/actions';
import { DocumentUploadCard } from '@/features/booking-documents/components/document-upload-card';
import { SelectedVehicleSummary } from '@/features/customer-booking/components/selected-vehicle-summary';
import { formatDate } from '@/lib/format';
import type { BookingDocumentSummary, BookingWithVehicle } from '@/types';

export function BookingDocumentsPanel({
  booking,
  initialDocuments,
}: {
  readonly booking: BookingWithVehicle;
  readonly initialDocuments: readonly BookingDocumentSummary[];
}) {
  const router = useRouter();
  const locked = booking.document_submitted;
  const [documents, setDocuments] = useState<Record<string, BookingDocumentSummary>>(() => {
    const map: Record<string, BookingDocumentSummary> = {};
    for (const doc of initialDocuments) {
      map[doc.documentType] = doc;
    }
    return map;
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const uploadedCount = useMemo(() => {
    return requiredBookingDocumentTypes().filter((type) => Boolean(documents[type])).length;
  }, [documents]);

  const requiredCount = requiredBookingDocumentTypes().length;
  const allRequiredUploaded = uploadedCount >= requiredCount;

  function onDocumentChanged(type: BookingDocumentType, next: BookingDocumentSummary | null) {
    setFormError(null);
    setDocuments((prev) => {
      const copy = { ...prev };
      if (next) {
        copy[type] = next;
      } else {
        delete copy[type];
      }
      return copy;
    });
  }

  function onSubmit() {
    if (locked) {
      router.push(customerBookingPath(booking.id));
      return;
    }

    if (!allRequiredUploaded) {
      setFormError('Please upload all required documents before continuing.');
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const result = await submitOwnBookingDocuments(booking.id);
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }

      router.push(customerBookingPath(booking.id));
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Booking request
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
            {locked ? 'Documents submitted' : 'Upload documents'}
          </h1>
          <div className="mt-3 h-1 w-12 bg-primary" aria-hidden="true" />
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {locked
              ? 'Your booking request and documents have been sent to Silver Carz for review.'
              : 'Upload the required identity documents so Silver Carz can review your booking request.'}
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Booking request
              </p>
              <p className="mt-1 text-xl font-bold tracking-wide text-foreground">
                {booking.invoice_number}
              </p>
            </div>
            <span className="rounded-md bg-tone-gold px-3 py-1.5 text-xs font-bold tracking-wide text-tone-gold-foreground uppercase">
              Pending approval
            </span>
          </div>

          <SelectedVehicleSummary vehicle={booking.vehicle} />

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Pickup
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {formatDate(booking.delivery_date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Return
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {formatDate(booking.return_date)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold tracking-wide text-foreground uppercase">
                Documents required
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {uploadedCount} / {requiredCount} submitted
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {BOOKING_DOCUMENT_REQUIREMENTS.map((requirement) => (
              <DocumentUploadCard
                key={requirement.type}
                bookingId={booking.id}
                requirement={requirement}
                document={documents[requirement.type] ?? null}
                locked={locked}
                onChanged={(next) => onDocumentChanged(requirement.type, next)}
              />
            ))}
          </div>
        </div>

        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to continue</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="h-11 min-w-44 rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
            disabled={isPending || (!locked && !allRequiredUploaded)}
            onClick={onSubmit}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                Submitting…
              </>
            ) : locked ? (
              'View request status'
            ) : (
              'Submit documents'
            )}
          </Button>
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-border bg-card p-5 lg:sticky lg:top-24">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Checklist
        </p>
        <ul className="mt-4 space-y-3">
          {BOOKING_DOCUMENT_REQUIREMENTS.map((requirement) => {
            const ready = Boolean(documents[requirement.type]);
            return (
              <li key={requirement.type} className="flex items-start gap-2 text-sm">
                <span
                  className={
                    ready
                      ? 'mt-0.5 size-2 shrink-0 rounded-full bg-success'
                      : 'mt-0.5 size-2 shrink-0 rounded-full bg-muted-foreground/40'
                  }
                  aria-hidden="true"
                />
                <span>
                  <span className="font-semibold text-foreground">{requirement.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ready ? (locked ? 'Submitted' : 'Uploaded') : 'Missing'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
