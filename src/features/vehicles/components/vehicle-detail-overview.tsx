import { VehicleAvailabilityBadge } from '@/features/vehicles/components/vehicle-availability-badge';
import { VehicleDetailImage } from '@/features/vehicles/components/vehicle-detail-image';
import { VehicleDetailField } from '@/features/vehicles/components/vehicle-detail-field';
import { VehicleDetailSection } from '@/features/vehicles/components/vehicle-detail-section';
import { VehicleStatusBadge } from '@/features/vehicles/components/vehicle-status-badge';
import type { Vehicle, VehicleAvailabilityStatus } from '@/types';

type VehicleDetailOverviewProps = {
  readonly vehicle: Vehicle;
  readonly availability: VehicleAvailabilityStatus | null;
};

/** Large overview card — identity, image, and status at a glance. */
export function VehicleDetailOverview({ vehicle, availability }: VehicleDetailOverviewProps) {
  return (
    <VehicleDetailSection
      title="Vehicle Overview"
      description="Identity and current operating state for this fleet unit."
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,16rem)_1fr] md:items-start">
        <VehicleDetailImage
          imagePath={vehicle.image_path}
          alt={`${vehicle.vehicle_name} photo`}
          className="mx-auto md:mx-0"
        />

        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-semibold tracking-tight">{vehicle.vehicle_name}</h2>
              <VehicleStatusBadge isActive={vehicle.is_active} />
              {availability ? <VehicleAvailabilityBadge availability={availability} /> : null}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {vehicle.vehicle_number}
              {vehicle.city ? ` · ${vehicle.city}` : ''}
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <VehicleDetailField label="Brand" value={vehicle.brand} />
            <VehicleDetailField label="Color" value={vehicle.color} />
            <VehicleDetailField
              label="Registration Number"
              value={<span className="tabular-nums">{vehicle.vehicle_number}</span>}
            />
            <VehicleDetailField label="City" value={vehicle.city} />
          </dl>
        </div>
      </div>
    </VehicleDetailSection>
  );
}
