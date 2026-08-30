'use client';

import { Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { markBookingPaid } from '@/features/bookings/actions/mark-booking-paid';
import { pricingFromBooking } from '@/features/bookings/service/pricing.service';
import { formatCurrency } from '@/lib/format';
import type { Booking, PaymentMethod } from '@/types';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_VALUES, PAYMENT_METHODS } from '@/types/enums';

type MarkBookingPaidDialogProps = {
  readonly booking: Booking;
  readonly vehicleName: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function MarkBookingPaidDialog({
  booking,
  vehicleName,
  open,
  onOpenChange,
}: MarkBookingPaidDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHODS.cash);
  const [paymentReference, setPaymentReference] = useState('');

  const pricing = pricingFromBooking(booking);
  const amountLabel = formatCurrency(pricing.grandTotal, { maximumFractionDigits: 0 });

  const handleConfirm = () => {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      const result = await markBookingPaid(booking.id, {
        paymentMethod,
        paymentReference,
        submittedAmount: pricing.grandTotal,
      });

      if (!result.success) {
        toast.error('Unable to record payment', { description: result.error.message });
        return;
      }

      toast.success('Payment recorded', {
        description: `Collection for ${result.data.invoice_number} is saved as paid.`,
      });
      onOpenChange(false);
      setPaymentReference('');
      setPaymentMethod(PAYMENT_METHODS.cash);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) {
          return;
        }
        onOpenChange(next);
        if (!next) {
          setPaymentReference('');
          setPaymentMethod(PAYMENT_METHODS.cash);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Paid</DialogTitle>
          <DialogDescription>
            Record payment collected when the customer picked up the vehicle. The amount is taken
            from the booking total, not from this form.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-1.5 rounded-xl border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Booking</dt>
            <dd className="font-medium tabular-nums">{booking.invoice_number}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="font-medium">{booking.customer_name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="font-medium">{vehicleName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total amount</dt>
            <dd className="font-semibold tabular-nums">{amountLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Amount being collected</dt>
            <dd className="font-semibold tabular-nums">{amountLabel}</dd>
          </div>
        </dl>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`collect-method-${booking.id}`}>Payment method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              disabled={isPending}
            >
              <SelectTrigger id={`collect-method-${booking.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PAYMENT_METHOD_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`collect-ref-${booking.id}`}>Transaction / reference (optional)</Label>
            <Input
              id={`collect-ref-${booking.id}`}
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              maxLength={120}
              disabled={isPending}
              placeholder="UPI ref, cheque no., last 4 digits…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            aria-busy={isPending}
            onClick={handleConfirm}
          >
            <Banknote className="size-4" aria-hidden="true" />
            {isPending ? 'Saving…' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
