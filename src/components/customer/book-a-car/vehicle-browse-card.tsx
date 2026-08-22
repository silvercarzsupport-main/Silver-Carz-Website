'use client';

import { CarFront, Fuel, Gauge, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  resolveVehicleAvailability,
  VehicleAvailabilityBadge,
} from '@/features/vehicles/components/vehicle-availability-badge';
import { getVehicleImagePublicUrl } from '@/features/vehicles/lib/vehicle-image-url';
import {
  buildCustomerBookACarSearchParams,
  type CustomerBookACarUrlState,
} from '@/features/vehicles/lib/public-vehicle-list-params';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicVehicle } from '@/types';
import { FUEL_TYPE_LABELS, TRANSMISSION_TYPE_LABELS } from '@/types/enums';

function VehicleBrowseMedia({
  imagePath,
  alt,
}: {
  imagePath: string | null | undefined;
  alt: string;
}) {
  const url = getVehicleImagePublicUrl(imagePath);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(url) && failedUrl !== url;

  return (
    <div className="relative flex aspect-[16/10] w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-secondary sm:aspect-auto sm:h-[7.5rem] sm:w-44">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL
        <img
          src={url!}
          alt={alt}
          className="max-h-full max-w-full object-contain p-2 sm:p-2.5"
          loading="lazy"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <CarFront className="size-10 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}

export function VehicleBrowseCard({
  vehicle,
  state,
  selected,
}: {
  vehicle: PublicVehicle;
  state: CustomerBookACarUrlState;
  selected: boolean;
}) {
  const availability = resolveVehicleAvailability(vehicle);
  const href = buildCustomerBookACarSearchParams(state, {
    vehicleId: selected ? null : vehicle.id,
  });
  const rate = formatCurrency(Number(vehicle.default_daily_rate), {
    maximumFractionDigits: 0,
  });

  return (
    <article
      className={cn(
        'relative flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm transition-colors sm:flex-row sm:items-center',
        selected
          ? 'border-primary ring-2 ring-primary/25'
          : 'border-border hover:border-foreground/20',
      )}
    >
      {selected ? (
        <span className="absolute top-3 left-3 z-10 rounded bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
          Selected
        </span>
      ) : null}

      <VehicleBrowseMedia imagePath={vehicle.image_path} alt={vehicle.vehicle_name} />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              {vehicle.vehicle_name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {vehicle.brand}
              {vehicle.color ? ` · ${vehicle.color}` : ''}
            </p>
          </div>
          {availability ? <VehicleAvailabilityBadge availability={availability} /> : null}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Fuel className="size-3.5" aria-hidden="true" />
            {FUEL_TYPE_LABELS[vehicle.fuel_type]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="size-3.5" aria-hidden="true" />
            {TRANSMISSION_TYPE_LABELS[vehicle.transmission_type]}
          </span>
          {vehicle.city ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {vehicle.city}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-border/70 pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
        <p className="text-sm text-muted-foreground">
          From <span className="text-base font-bold text-foreground">{rate || '—'}</span>
          <span className="text-muted-foreground"> /day</span>
        </p>
        <Button
          asChild
          variant={selected ? 'default' : 'outline'}
          className={cn(
            'h-10 min-w-[6.5rem] rounded-md font-semibold',
            selected && 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
          )}
        >
          <Link href={href} scroll={false}>
            {selected ? 'Selected' : 'Select'}
          </Link>
        </Button>
      </div>
    </article>
  );
}
