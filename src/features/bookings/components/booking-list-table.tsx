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
import { requiredBookingDocumentTypes } from '@/constants/booking-documents';
import { formatBookingDocumentCompletenessLabel } from '@/features/booking-documents/lib/completeness';
import { BookingRequestActions } from '@/features/bookings/components/booking-request-actions';
import { BookingRowActions } from '@/features/bookings/components/booking-row-actions';
import { BookingPaymentBadge } from '@/features/bookings/components/booking-payment-badge';
import { BookingStatusBadge } from '@/features/bookings/components/booking-status-badge';
import {
  BOOKING_LIST_VIEWS,
  buildBookingListSearchParams,
  type BookingListUrlState,
} from '@/features/bookings/lib/booking-list-params';
import { VehicleInline } from '@/features/vehicles/components/vehicle-inline';
import { VehicleThumbnail } from '@/features/vehicles/components/vehicle-thumbnail';
import { bookingDetailPath } from '@/constants/routes';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BookingSortField, BookingWithVehicle } from '@/types';
import { RENTAL_MODE_LABELS } from '@/types';

const SORTABLE_COLUMNS: Record<string, BookingSortField> = {
  invoice_number: 'invoice_number',
  customer_name: 'customer_name',
  delivery_date: 'delivery_date',
  return_date: 'return_date',
  created_at: 'created_at',
};

type BookingListTableProps = {
  readonly data: readonly BookingWithVehicle[];
  readonly state: BookingListUrlState;
  /** Uploaded document counts keyed by booking id (pending queue). */
  readonly documentCounts?: Readonly<Record<string, number>>;
};

function SortIcon({
  columnId,
  sortBy,
  sortOrder,
}: {
  columnId: string;
  sortBy: BookingSortField;
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

export function BookingListTable({ data, state, documentCounts = {} }: BookingListTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const requiredDocumentCount = requiredBookingDocumentTypes().length;

  const sorting = useMemo<SortingState>(
    () => [{ id: state.sortBy, desc: state.sortOrder === 'desc' }],
    [state.sortBy, state.sortOrder],
  );

  const columns = useMemo<ColumnDef<BookingWithVehicle>[]>(
    () => [
      {
        id: 'invoice_number',
        accessorKey: 'invoice_number',
        header: 'Invoice',
        cell: ({ row }) => (
          <Link
            href={bookingDetailPath(row.original.id)}
            className="font-medium text-foreground tabular-nums underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {row.original.invoice_number}
          </Link>
        ),
      },
      {
        id: 'customer_name',
        accessorKey: 'customer_name',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="max-w-[12rem] min-w-[9rem]">
            <p className="truncate font-medium">{row.original.customer_name}</p>
            {row.original.contact_number ? (
              <p className="truncate text-xs text-muted-foreground">
                {row.original.contact_number}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'vehicle',
        accessorFn: (row) => row.vehicle.vehicle_number,
        header: 'Vehicle',
        enableSorting: false,
        cell: ({ row }) => (
          <VehicleInline
            imagePath={row.original.vehicle.image_path}
            name={row.original.vehicle.vehicle_name}
            number={row.original.vehicle.vehicle_number}
            size="xs"
            className="max-w-[14rem] min-w-[10rem]"
          />
        ),
      },
      {
        id: 'mode',
        accessorKey: 'mode',
        header: 'Mode',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{RENTAL_MODE_LABELS[row.original.mode]}</span>
        ),
      },
      {
        id: 'delivery_date',
        accessorKey: 'delivery_date',
        header: 'Delivery',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDate(row.original.delivery_date)}</span>
        ),
      },
      {
        id: 'return_date',
        accessorKey: 'return_date',
        header: 'Return',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatDate(row.original.return_date)}</span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <BookingStatusBadge booking={row.original} />
            <BookingPaymentBadge booking={row.original} />
          </div>
        ),
      },
      {
        id: 'documents',
        accessorKey: 'document_submitted',
        header: 'Documents',
        enableSorting: false,
        cell: ({ row }) => {
          const submittedCount = Math.min(
            documentCounts[row.original.id] ??
              (row.original.document_submitted ? requiredDocumentCount : 0),
            requiredDocumentCount,
          );
          const isComplete =
            row.original.document_submitted || submittedCount >= requiredDocumentCount;
          const label = formatBookingDocumentCompletenessLabel({
            submittedCount,
            requiredCount: requiredDocumentCount,
            isComplete,
          });

          return (
            <span
              className={cn(
                'text-sm tabular-nums',
                isComplete ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {isComplete ? 'Complete' : label}
              {!isComplete ? (
                <span className="sr-only">
                  {` ${submittedCount} of ${requiredDocumentCount} required documents`}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'total_amount',
        accessorKey: 'total_amount',
        header: 'Total',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(row.original.total_amount)}
          </span>
        ),
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatDateTime(row.original.created_at)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const submittedCount = Math.min(
            documentCounts[row.original.id] ??
              (row.original.document_submitted ? requiredDocumentCount : 0),
            requiredDocumentCount,
          );
          const documentsComplete =
            row.original.document_submitted || submittedCount >= requiredDocumentCount;

          return (
            <div className="flex items-center justify-end gap-2">
              {state.view === BOOKING_LIST_VIEWS.pending ? (
                <BookingRequestActions
                  bookingId={row.original.id}
                  invoiceNumber={row.original.invoice_number}
                  customerName={row.original.customer_name}
                  vehicleName={row.original.vehicle.vehicle_name}
                  deliveryDate={row.original.delivery_date}
                  returnDate={row.original.return_date}
                  documentsComplete={documentsComplete}
                />
              ) : null}
              <BookingRowActions
                bookingId={row.original.id}
                invoiceNumber={row.original.invoice_number}
              />
            </div>
          );
        },
      },
    ],
    [documentCounts, requiredDocumentCount, state.view],
  );

  // TanStack Table returns unstable function identities — React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library -- required table API
  const table = useReactTable({
    data: data as BookingWithVehicle[],
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

    const query = buildBookingListSearchParams(state, {
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
      {/* Desktop / tablet table */}
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
                          isActions &&
                            (state.view === BOOKING_LIST_VIEWS.pending
                              ? 'min-w-[18rem] text-right'
                              : 'w-12 text-right'),
                          header.column.id === 'total_amount' && 'text-right',
                          header.column.id === 'status' && 'w-[7.5rem]',
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
                        cell.column.id === 'total_amount' && 'text-right',
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

      {/* Mobile stacked cards */}
      <ul
        className={cn('space-y-3 lg:hidden', isPending && 'pointer-events-none opacity-70')}
        aria-busy={isPending}
        aria-label="Bookings"
      >
        {data.map((booking) => {
          const submittedCount = Math.min(
            documentCounts[booking.id] ?? (booking.document_submitted ? requiredDocumentCount : 0),
            requiredDocumentCount,
          );
          const documentsComplete =
            booking.document_submitted || submittedCount >= requiredDocumentCount;
          const documentsLabel = formatBookingDocumentCompletenessLabel({
            submittedCount,
            requiredCount: requiredDocumentCount,
            isComplete: documentsComplete,
          });

          return (
            <li key={booking.id}>
              <article className="rounded-3xl border bg-card p-4 transition-colors hover:bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <VehicleThumbnail
                      imagePath={booking.vehicle.image_path}
                      alt={`${booking.vehicle.vehicle_name} photo`}
                      size="md"
                    />
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={bookingDetailPath(booking.id)}
                        className="block truncate font-semibold tabular-nums underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {booking.invoice_number}
                      </Link>
                      <p className="truncate text-sm font-medium">{booking.customer_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {booking.vehicle.vehicle_name} · {booking.vehicle.vehicle_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <BookingStatusBadge booking={booking} />
                      <BookingRowActions
                        bookingId={booking.id}
                        invoiceNumber={booking.invoice_number}
                      />
                    </div>
                    <BookingPaymentBadge booking={booking} />
                  </div>
                </div>
                {state.view === BOOKING_LIST_VIEWS.pending ? (
                  <div className="mt-3">
                    <BookingRequestActions
                      bookingId={booking.id}
                      invoiceNumber={booking.invoice_number}
                      customerName={booking.customer_name}
                      vehicleName={booking.vehicle.vehicle_name}
                      deliveryDate={booking.delivery_date}
                      returnDate={booking.return_date}
                      documentsComplete={documentsComplete}
                    />
                  </div>
                ) : null}
                <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Mode</dt>
                    <dd className="truncate">{RENTAL_MODE_LABELS[booking.mode]}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Total</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(booking.total_amount)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Delivery</dt>
                    <dd className="tabular-nums">{formatDate(booking.delivery_date)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Return</dt>
                    <dd className="tabular-nums">{formatDate(booking.return_date)}</dd>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <dt className="text-xs text-muted-foreground">Documents</dt>
                    <dd className={documentsComplete ? 'text-success' : undefined}>
                      {documentsComplete ? 'Complete' : documentsLabel}
                    </dd>
                  </div>
                </dl>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
