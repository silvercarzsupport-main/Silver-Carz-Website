import { Badge } from '@/components/ui/badge';
import { getOfflinePaymentPresentation } from '@/features/bookings/lib/offline-payment';
import type { BookingStatusInput } from '@/features/bookings/service/status.service';
import { cn } from '@/lib/utils';
import type { OfflinePaymentStatus } from '@/types/enums';

type BookingPaymentBadgeProps = {
  readonly booking: BookingStatusInput & {
    readonly payment_status?: OfflinePaymentStatus | null;
  };
  readonly className?: string;
  readonly audience?: 'admin' | 'customer';
};

export function BookingPaymentBadge({
  booking,
  className,
  audience = 'admin',
}: BookingPaymentBadgeProps) {
  const presentation = getOfflinePaymentPresentation(booking);
  const label = audience === 'customer' ? presentation.customerLabel : presentation.adminLabel;

  if (!presentation.applicable || !label) {
    return null;
  }

  return (
    <Badge
      variant={presentation.collected ? 'secondary' : 'outline'}
      className={cn('font-medium tracking-wide', className)}
      aria-label={`Payment: ${label}`}
    >
      {label}
    </Badge>
  );
}
