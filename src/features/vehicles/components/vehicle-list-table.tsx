'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { vehicleDetailPath } from '@/constants/routes';
import {
  resolveVehicleAvailability,
  VehicleAvailabilityBadge,
} from '@/features/vehicles/components/vehicle-availability-badge';
import { VehicleRowActions } from '@/features/vehicles/components/vehicle-row-actions';
import { VehicleStatusBadge } from '@/features/vehicles/components/vehicle-status-badge';
import { VehicleThumbnail } from '@/features/vehicles/components/vehicle-thumbnail';
import {
  buildVehicleListSearchParams,
  type VehicleListUrlState,
} from '@/features/vehicles/lib/vehicle-list-params';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Vehicle, VehicleSortField } from '@/types';
import { FUEL_TYPE_LABELS } from '@/types';

const SORTABLE_COLUMNS: Record<string, VehicleSortField> = {
  vehicle_name: 'vehicle_name',
  vehicle_number: 'vehicle_number',
  fuel_type: 'fuel_type',
  created_at: 'created_at',
};

type VehicleListTableProps = {
  readonly data: readonly Vehicle[];
  readonly state: VehicleListUrlState;
};

function SortIcon({
  columnId,
  sortBy,
  sortOrder,
}: {
  columnId: string;
  sortBy: VehicleSortField;
  sortOrder: 'asc' | 'desc';
}) {
  const field = SORTABLE_COLUMNS[columnId];
  if (!field) {
    return null;
  }

  if (sortBy !== field) {
    return <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />;
  }

  return sortOrder === 'asc' ? (
    <ArrowUp className="size-3.5" aria-hidden="true" />
  ) : (
    <ArrowDown className="size-3.5" aria-hidden="true" />
  );
}

export function VehicleListTable({ data, state }: VehicleListTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const sorting = useMemo<SortingState>(
    () => [{ id: state.sortBy, desc: state.sortOrder === 'desc' }],
    [state.sortBy, state.sortOrder],
  );

  const columns = useMemo<ColumnDef<Vehicle>[]>(
    () => [
      {
        id: 'vehicle_name',
        accessorKey: 'vehicle_name',
        header: 'Vehicle Name',
        cell: ({ row }) => (
          <Link
            href={vehicleDetailPath(row.original.id)}
            className="flex max-w-[16rem] items-center gap-2.5 focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <VehicleThumbnail
              imagePath={row.original.image_path}
              alt={`${row.original.vehicle_name} photo`}
              size="xs"
            />
            <span className="truncate font-medium text-foreground underline-offset-4 hover:underline">
              {row.original.vehicle_name}
            </span>
          </Link>
        ),
      },
      {
        id: 'vehicle_number',
        accessorKey: 'vehicle_number',
        header: 'Vehicle Number',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{row.original.vehicle_number}</span>
        ),
      },
      {
        id: 'fuel_type',
        accessorKey: 'fuel_type',
        header: 'Fuel Type',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{FUEL_TYPE_LABELS[row.original.fuel_type]}</span>
        ),
      },
      {
        id: 'city',
        accessorKey: 'city',
        header: 'City',
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.city}</span>,
      },
      {
        id: 'default_daily_rate',
        accessorKey: 'default_daily_rate',
        header: 'Daily Charge',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(row.original.default_daily_rate)}
          </span>
        ),
      },
      {
        id: 'availability',
        header: 'Availability',
        enableSorting: false,
        cell: ({ row }) => {
          const availability = resolveVehicleAvailability(row.original);
          if (!availability) {
            return <span className="text-muted-foreground">—</span>;
          }
          return <VehicleAvailabilityBadge availability={availability} />;
        },
      },
      {
        id: 'status',
        accessorKey: 'is_active',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => <VehicleStatusBadge isActive={row.original.is_active} />,
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Created Date',
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <VehicleRowActions
              vehicleId={row.original.id}
              vehicleName={row.original.vehicle_name}
            />
          </div>
        ),
      },
    ],
    [],
  );

  // TanStack Table returns unstable function identities — React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library -- required table API
  const table = useReactTable({
    data: data as Vehicle[],
    columns,
    state: { sorting },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  function onSort(columnId: string) {
    const field = SORTABLE_COLUMNS[columnId];
    if (!field) {
      return;
    }

    const nextOrder =
      state.sortBy === field ? (state.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';

    const query = buildVehicleListSearchParams(state, {
      sortBy: field,
      sortOrder: nextOrder,
      page: 1,
    });

    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <>
      <div
        className={cn(
          'hidden overflow-hidden rounded-3xl border bg-card lg:block',
          isPending && 'pointer-events-none opacity-70',
        )}
        aria-busy={isPending}
      >
        <div className="max-h-[min(70vh,44rem)] overflow-auto">
          <table className="w-full min-w-[56rem] caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 border-b bg-card/95 shadow-[0_1px_0_0_var(--border)] backdrop-blur supports-backdrop-filter:bg-card/80">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-0 hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const sortable = Boolean(SORTABLE_COLUMNS[header.column.id]);
                    const label = flexRender(header.column.columnDef.header, header.getContext());
                    const isActions = header.column.id === 'actions';

                    return (
                      <TableHead
                        key={header.id}
                        scope="col"
                        className={cn(
                          'h-11 bg-transparent px-3',
                          isActions && 'w-12 text-right',
                          header.column.id === 'default_daily_rate' && 'text-right',
                          header.column.id === 'status' && 'w-[7rem]',
                          header.column.id === 'availability' && 'w-[8rem]',
                        )}
                      >
                        {header.isPlaceholder ? null : sortable ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-8 gap-1.5 px-2 font-medium text-foreground"
                            onClick={() => onSort(header.column.id)}
                            aria-label={`Sort by ${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.column.id}`}
                          >
                            {label}
                            <SortIcon
                              columnId={header.column.id}
                              sortBy={state.sortBy}
                              sortOrder={state.sortOrder}
                            />
                          </Button>
                        ) : (
                          label
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'px-3 py-2.5',
                        cell.column.id === 'default_daily_rate' && 'text-right',
                        cell.column.id === 'actions' && 'text-right',
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </div>

      <ul
        className={cn('space-y-3 lg:hidden', isPending && 'pointer-events-none opacity-70')}
        aria-busy={isPending}
        aria-label="Vehicles"
      >
        {data.map((vehicle) => {
          const availability = resolveVehicleAvailability(vehicle);

          return (
            <li key={vehicle.id}>
              <article className="rounded-3xl border bg-card p-4 transition-colors hover:bg-muted/20">
                <div className="flex items-start gap-3">
                  <VehicleThumbnail
                    imagePath={vehicle.image_path}
                    alt={`${vehicle.vehicle_name} thumbnail`}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={vehicleDetailPath(vehicle.id)}
                          className="block truncate font-semibold underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {vehicle.vehicle_name}
                        </Link>
                        <p className="truncate text-sm text-muted-foreground tabular-nums">
                          {vehicle.vehicle_number}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <VehicleStatusBadge isActive={vehicle.is_active} />
                        <VehicleRowActions
                          vehicleId={vehicle.id}
                          vehicleName={vehicle.vehicle_name}
                        />
                      </div>
                    </div>
                    <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-3 text-sm">
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Fuel type</dt>
                        <dd className="truncate">{FUEL_TYPE_LABELS[vehicle.fuel_type]}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">City</dt>
                        <dd className="truncate">{vehicle.city}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Daily charge</dt>
                        <dd className="font-medium tabular-nums">
                          {formatCurrency(vehicle.default_daily_rate)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Availability</dt>
                        <dd>
                          {availability ? (
                            <VehicleAvailabilityBadge availability={availability} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Created</dt>
                        <dd className="tabular-nums">{formatDate(vehicle.created_at)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
