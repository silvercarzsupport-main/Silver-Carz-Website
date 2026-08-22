import { Car } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/shared/empty-state';
import { PageContainer } from '@/components/shared/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ROUTES } from '@/constants/routes';
import {
  resolveVehicleAvailability,
  VehicleAvailabilityBadge,
} from '@/features/vehicles/components/vehicle-availability-badge';
import { VehicleBreadcrumb } from '@/features/vehicles/components/vehicle-breadcrumb';
import { VehicleDetailActions } from '@/features/vehicles/components/vehicle-detail-actions';
import { VehicleDetailField } from '@/features/vehicles/components/vehicle-detail-field';
import { VehicleDetailOverview } from '@/features/vehicles/components/vehicle-detail-overview';
import { VehicleDetailQuickActions } from '@/features/vehicles/components/vehicle-detail-quick-actions';
import { VehicleDetailSection } from '@/features/vehicles/components/vehicle-detail-section';
import { VehicleDetailStats } from '@/features/vehicles/components/vehicle-detail-stats';
import { VehicleRecentBookings } from '@/features/vehicles/components/vehicle-recent-bookings';
import { VehicleStatusBadge } from '@/features/vehicles/components/vehicle-status-badge';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  FUEL_TYPE_LABELS,
  TRANSMISSION_TYPE_LABELS,
  VEHICLE_AVAILABILITY_STATUS_LABELS,
  type BookingWithVehicle,
  type Vehicle,
} from '@/types';

type VehicleDetailPageProps = {
  readonly vehicle?: Vehicle;
  readonly recentBookings?: readonly BookingWithVehicle[];
  /**
   * Total bookings from the bookings backend.
   * `null` when the count could not be loaded (isolated placeholder).
   */
  readonly totalBookings?: number | null;
  readonly bookingsLoadError?: string | null;
  readonly loadError?: string;
};

function formatOptionalCurrency(amount: number | null | undefined): string {
  const formatted = formatCurrency(amount);
  return formatted || '—';
}

export function VehicleDetailPage({
  vehicle,
  recentBookings = [],
  totalBookings = null,
  bookingsLoadError = null,
  loadError,
}: VehicleDetailPageProps) {
  if (loadError || !vehicle) {
    return (
      <PageContainer className="max-w-5xl">
        <div className="space-y-4">
          <VehicleBreadcrumb current="Vehicle" />
        </div>

        {loadError ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Unable to load vehicle</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{loadError}</span>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={ROUTES.vehicles}>Back to Fleet</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <EmptyState
            icon={Car}
            title="Vehicle not found"
            description="This vehicle may have been removed, or you may not have permission to view it."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.vehicles}>Return to Fleet</Link>
              </Button>
            }
          />
        )}
      </PageContainer>
    );
  }

  const availability = resolveVehicleAvailability(vehicle);

  return (
    <PageContainer className="max-w-5xl">
      <div className="space-y-4">
        <VehicleBreadcrumb current="Vehicle" />

        <header className="space-y-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">{vehicle.vehicle_name}</h1>
              <VehicleStatusBadge isActive={vehicle.is_active} />
              {availability ? <VehicleAvailabilityBadge availability={availability} /> : null}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {vehicle.vehicle_number}
              {vehicle.city ? ` · ${vehicle.city}` : ''}
            </p>
          </div>

          <VehicleDetailActions vehicleId={vehicle.id} />
        </header>
      </div>

      <Separator className="my-1" />

      <VehicleDetailOverview vehicle={vehicle} availability={availability} />

      <VehicleDetailStats
        stats={{
          dailyRate: vehicle.default_daily_rate,
          fuelType: vehicle.fuel_type,
          totalBookings,
        }}
      />

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <VehicleDetailSection
          title="Vehicle Information"
          description="Core identity and registry details."
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <VehicleDetailField label="Vehicle Name" value={vehicle.vehicle_name} />
            <VehicleDetailField
              label="Registration Number"
              value={<span className="tabular-nums">{vehicle.vehicle_number}</span>}
            />
            <VehicleDetailField label="Brand" value={vehicle.brand} />
            <VehicleDetailField label="Color" value={vehicle.color} />
            <VehicleDetailField label="City" value={vehicle.city} />
            <VehicleDetailField
              label="Created Date"
              value={<span className="tabular-nums">{formatDateTime(vehicle.created_at)}</span>}
            />
            <VehicleDetailField
              label="Last Updated"
              value={<span className="tabular-nums">{formatDateTime(vehicle.updated_at)}</span>}
              className="sm:col-span-2"
            />
          </dl>
        </VehicleDetailSection>

        <VehicleDetailSection
          title="Rental Information"
          description="Default commercial rates for this unit."
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <VehicleDetailField label="Fuel Type" value={FUEL_TYPE_LABELS[vehicle.fuel_type]} />
            <VehicleDetailField
              label="Transmission Type"
              value={TRANSMISSION_TYPE_LABELS[vehicle.transmission_type]}
            />
            <VehicleDetailField
              label="Daily Rental Rate"
              value={
                <span className="tabular-nums">
                  {formatOptionalCurrency(vehicle.default_daily_rate)}
                </span>
              }
            />
          </dl>
        </VehicleDetailSection>
      </div>

      <VehicleDetailSection
        title="Operational Information"
        description="Availability and roster status."
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <VehicleDetailField
            label="Availability"
            value={
              availability ? (
                <VehicleAvailabilityBadge availability={availability} />
              ) : (
                VEHICLE_AVAILABILITY_STATUS_LABELS.available
              )
            }
          />
          <VehicleDetailField
            label="Vehicle Status"
            value={<VehicleStatusBadge isActive={vehicle.is_active} />}
          />
        </dl>
      </VehicleDetailSection>

      <VehicleRecentBookings bookings={recentBookings} loadError={bookingsLoadError} />

      <VehicleDetailQuickActions vehicleId={vehicle.id} />
    </PageContainer>
  );
}
