'use client';

/**
 * Detail workspace action bar (C5 approval / rejection dialogs).
 */

import { Ban, Check, Pencil, Printer } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { bookingEditPath, ROUTES } from '@/constants/routes';
import { approveBooking } from '@/features/bookings/actions/approve-booking';
import { deleteBooking } from '@/features/bookings/actions/delete-booking';
import { rejectBooking } from '@/features/bookings/actions/reject-booking';
import { MarkBookingPaidDialog } from '@/features/bookings/components/mark-booking-paid-dialog';
import { getOfflinePaymentPresentation } from '@/features/bookings/lib/offline-payment';
import {
  BOOKING_DISPLAY_STATUSES,
  resolveBookingDisplayStatus,
} from '@/features/bookings/service/status.service';
import { formatDate } from '@/lib/format';
import type { Booking } from '@/types';

type BookingDetailActionsProps = {
  readonly bookingId: string;
  readonly booking: Booking;
  readonly vehicleName: string;
  readonly documentsComplete: boolean;
  readonly documentsIncompleteMessage?: string | null;
};

export function BookingDetailActions({
  bookingId,
  booking,
  vehicleName,
  documentsComplete,
  documentsIncompleteMessage,
}: BookingDetailActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const display = resolveBookingDisplayStatus(booking);
  const isDraft = display === BOOKING_DISPLAY_STATUSES.draft;
  const isTerminal =
    display === BOOKING_DISPLAY_STATUSES.cancelled || display === BOOKING_DISPLAY_STATUSES.denied;
  const payment = getOfflinePaymentPresentation(booking);

  const handleApproveRequest = () => {
    if (!isDraft) {
      return;
    }

    if (!documentsComplete) {
      toast.error('Unable to approve request', {
        description: documentsIncompleteMessage ?? 'Required documents are incomplete.',
      });
      return;
    }

    startTransition(async () => {
      const result = await approveBooking(bookingId);

      if (!result.success) {
        toast.error('Unable to approve request', { description: result.error.message });
        return;
      }

      toast.success('Request approved', {
        description: `Invoice ${result.data.invoice_number} is confirmed. The vehicle is reserved. The customer will be told payment is due at pickup.`,
      });
      window.location.assign(ROUTES.bookingsConfirmed);
    });
  };

  const handleRejectRequest = () => {
    if (!isDraft) {
      return;
    }

    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setRejectError('A rejection reason is required.');
      return;
    }

    setRejectError(null);
    startTransition(async () => {
      const result = await rejectBooking(bookingId, trimmed);

      if (!result.success) {
        toast.error('Unable to reject request', { description: result.error.message });
        return;
      }

      toast.success('Request rejected', {
        description: `Invoice ${result.data.invoice_number} was marked as Denied.`,
      });
      window.location.assign(ROUTES.bookings);
    });
  };

  const handleCancelBooking = () => {
    if (isTerminal || isDraft) {
      return;
    }

    if (
      !window.confirm(
        'Cancel this booking? The vehicle will be released according to availability rules.',
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteBooking(bookingId);

      if (!result.success) {
        toast.error('Unable to cancel booking', { description: result.error.message });
        return;
      }

      toast.success('Booking cancelled', {
        description: `Invoice ${result.data.invoice_number} was cancelled.`,
      });
      window.location.assign(ROUTES.bookings);
    });
  };

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
      role="toolbar"
      aria-label="Booking actions"
    >
      {isDraft ? (
        <>
          <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                disabled={isPending || !documentsComplete}
                aria-busy={isPending}
                aria-label="Approve booking request"
                title={
                  documentsComplete
                    ? undefined
                    : (documentsIncompleteMessage ?? 'Required documents are incomplete.')
                }
              >
                <Check className="size-4" aria-hidden="true" />
                Approve Booking
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="default" className="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Approve this booking request?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      The booking will be confirmed and the vehicle will be reserved for these
                      dates. The customer will be notified that payment is due at vehicle pickup.
                      The booking number stays {booking.invoice_number}.
                    </p>
                    <dl className="space-y-1 rounded-xl border bg-muted/30 p-3 text-left text-foreground">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Customer</dt>
                        <dd className="font-medium">{booking.customer_name}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Vehicle</dt>
                        <dd className="font-medium">{vehicleName}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Pickup</dt>
                        <dd className="font-medium tabular-nums">
                          {formatDate(booking.delivery_date)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Return</dt>
                        <dd className="font-medium tabular-nums">
                          {formatDate(booking.return_date)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  disabled={isPending}
                  aria-busy={isPending}
                  onClick={handleApproveRequest}
                >
                  Approve Booking
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog
            open={rejectOpen}
            onOpenChange={(open) => {
              setRejectOpen(open);
              if (!open) {
                setRejectError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive"
                disabled={isPending}
                aria-busy={isPending}
                aria-label="Reject booking request"
              >
                <Ban className="size-4" aria-hidden="true" />
                Reject Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reject Booking</DialogTitle>
                <DialogDescription>
                  Provide a reason for denying this request. The customer will see this reason.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor={`detail-reject-reason-${bookingId}`}>Reason</Label>
                <Textarea
                  id={`detail-reject-reason-${bookingId}`}
                  value={rejectionReason}
                  onChange={(event) => {
                    setRejectionReason(event.target.value);
                    if (rejectError) {
                      setRejectError(null);
                    }
                  }}
                  placeholder="Explain why this request cannot be approved…"
                  rows={4}
                  maxLength={1000}
                  aria-invalid={rejectError ? true : undefined}
                  aria-describedby={rejectError ? `detail-reject-error-${bookingId}` : undefined}
                  disabled={isPending}
                />
                {rejectError ? (
                  <p
                    id={`detail-reject-error-${bookingId}`}
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {rejectError}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setRejectOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  aria-busy={isPending}
                  onClick={handleRejectRequest}
                >
                  Reject Booking
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {!isDraft && payment.canCollect ? (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          aria-busy={isPending}
          onClick={() => setCollectOpen(true)}
        >
          Mark as Paid
        </Button>
      ) : null}

      {!isDraft && payment.collected ? (
        <Button type="button" size="sm" variant="secondary" disabled aria-disabled="true">
          Paid
        </Button>
      ) : null}

      <MarkBookingPaidDialog
        booking={booking}
        vehicleName={vehicleName}
        open={collectOpen}
        onOpenChange={setCollectOpen}
      />

      {!documentsComplete && isDraft && documentsIncompleteMessage ? (
        <p className="col-span-2 text-sm text-destructive sm:basis-full" role="status">
          {documentsIncompleteMessage}
        </p>
      ) : null}

      {!isTerminal ? (
        <Button asChild size="sm" variant={isDraft ? 'outline' : 'default'}>
          <Link href={bookingEditPath(bookingId)}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit Booking
          </Link>
        </Button>
      ) : (
        <Button size="sm" disabled aria-disabled="true">
          <Pencil className="size-4" aria-hidden="true" />
          Edit Booking
        </Button>
      )}

      <Button asChild variant="outline" size="sm">
        <Link href={ROUTES.bookings}>
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Back to Bookings</span>
        </Link>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        aria-disabled="true"
        title="Invoice printing will be available in a future release"
      >
        <Printer className="size-4" aria-hidden="true" />
        <span className="sm:hidden">Print</span>
        <span className="hidden sm:inline">Print Invoice</span>
      </Button>

      {!isDraft ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive"
          disabled={isPending || isTerminal}
          aria-busy={isPending}
          onClick={handleCancelBooking}
          aria-label="Cancel booking"
        >
          <Ban className="size-4" aria-hidden="true" />
          {isTerminal ? (
            display === BOOKING_DISPLAY_STATUSES.denied ? (
              'Denied'
            ) : (
              'Cancelled'
            )
          ) : (
            <>
              <span className="sm:hidden">Cancel</span>
              <span className="hidden sm:inline">Cancel Booking</span>
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}
