import { VehicleThumbnail } from '@/features/vehicles/components/vehicle-thumbnail';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicVehicle } from '@/types';
import { FUEL_TYPE_LABELS, TRANSMISSION_TYPE_LABELS } from '@/types/enums';

export function SelectedVehicleSummary({
  vehicle,
  className,
  compact = false,
}: {
  readonly vehicle: Pick<
    PublicVehicle,
    | 'vehicle_name'
    | 'image_path'
    | 'fuel_type'
    | 'transmission_type'
    | 'default_daily_rate'
    | 'brand'
    | 'color'
    | 'city'
  >;
  readonly className?: string;
  readonly compact?: boolean;
}) {
  const rate = formatCurrency(Number(vehicle.default_daily_rate), { maximumFractionDigits: 0 });

  return (
    <div
      className={cn(
        'flex gap-4 rounded-lg border border-border bg-card p-4',
        compact && 'p-3',
        className,
      )}
    >
      <VehicleThumbnail
        imagePath={vehicle.image_path}
        alt={vehicle.vehicle_name}
        fit="contain"
        className={cn(
          'rounded-md bg-surface-secondary',
          compact ? 'h-16 w-24' : 'h-24 w-36 sm:h-28 sm:w-40',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('font-bold text-foreground', compact ? 'text-base' : 'text-lg')}>
          {vehicle.vehicle_name}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {[vehicle.brand, vehicle.color, vehicle.city].filter(Boolean).join(' · ') ||
            'Silver Carz fleet'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {FUEL_TYPE_LABELS[vehicle.fuel_type]} ·{' '}
          {TRANSMISSION_TYPE_LABELS[vehicle.transmission_type]}
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">{rate} /day</p>
      </div>
    </div>
  );
}
