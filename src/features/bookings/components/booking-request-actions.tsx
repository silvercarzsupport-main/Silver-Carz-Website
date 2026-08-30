'use client';

/**
 * Approve / Reject controls for pending draft booking requests (C5).
 */

import { Ban, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { approveBooking } from '@/features/bookings/actions/approve-booking';
import { rejectBooking } from '@/features/bookings/actions/reject-booking';
import { formatDate } from '@/lib/format';

type BookingRequestActionsProps = {
  readonly bookingId: string;
  readonly invoiceNumber: string;
  readonly customerName: string;
  readonly vehicleName: string;
  readonly deliveryDate: string;
  readonly returnDate: string;
  readonly documentsComplete?: boolean;
};

export function BookingRequestActions({
  bookingId,
  invoiceNumber,
  customerName,
  vehicleName,
  deliveryDate,
  returnDate,
  documentsComplete = true,
}: BookingRequestActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveBooking(bookingId);

      if (!result.success) {
        toast.error('Unable to approve request', { description: result.error.message });
        return;
      }

      toast.success('Request approved', {
        description: `Invoice ${result.data.invoice_number} is confirmed. The vehicle is reserved. Payment is due at pickup.`,
      });
      setApproveOpen(false);
      router.refresh();
    });
  };

  const handleReject = () => {
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
      setRejectOpen(false);
      setRejectionReason('');
      router.refresh();
    });
  };

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-1.5"
      role="group"
      aria-label="Request actions"
    >
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !documentsComplete}
            aria-busy={isPending}
            aria-label={`Approve request ${invoiceNumber}`}
            title={
              documentsComplete
                ? undefined
                : 'Required documents are incomplete. Open the request to review.'
            }
          >
            <Check className="size-4" aria-hidden="true" />
            Approve
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="default" className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this booking request?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  The booking will be confirmed and the vehicle will be reserved for these dates.
                  The customer will be notified that payment is due at vehicle pickup.
                </p>
                <dl className="space-y-1 rounded-xl border bg-muted/30 p-3 text-left text-foreground">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Invoice</dt>
                    <dd className="font-medium tabular-nums">{invoiceNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd className="font-medium">{customerName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Vehicle</dt>
                    <dd className="font-medium">{vehicleName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Pickup</dt>
                    <dd className="font-medium tabular-nums">{formatDate(deliveryDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Return</dt>
                    <dd className="font-medium tabular-nums">{formatDate(returnDate)}</dd>
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
              onClick={handleApprove}
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
            aria-label={`Reject request ${invoiceNumber}`}
          >
            <Ban className="size-4" aria-hidden="true" />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
            <DialogDescription>
              Provide a reason for denying invoice {invoiceNumber}. The customer will see this
              reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`reject-reason-${bookingId}`}>Reason</Label>
            <Textarea
              id={`reject-reason-${bookingId}`}
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
              aria-describedby={rejectError ? `reject-error-${bookingId}` : undefined}
              disabled={isPending}
            />
            {rejectError ? (
              <p id={`reject-error-${bookingId}`} className="text-sm text-destructive" role="alert">
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
              onClick={handleReject}
            >
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
