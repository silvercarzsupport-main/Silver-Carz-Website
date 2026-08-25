'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  getBookingHorizonEndIso,
  todayIsoIst,
} from '@/features/customer-booking/lib/calendar-dates';
import {
  buildCustomerBookACarSearchParams,
  validateBrowseDateRange,
  type CustomerAvailabilityFilter,
  type CustomerBookACarUrlState,
} from '@/features/vehicles/lib/public-vehicle-list-params';
import { cn } from '@/lib/utils';

const AVAILABILITY_OPTIONS: { value: CustomerAvailabilityFilter; label: string }[] = [
  { value: 'all', label: 'All Cars' },
  { value: 'available', label: 'Available' },
];

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        'inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold tracking-wide uppercase transition-colors sm:text-sm',
        active
          ? 'border-secondary bg-secondary text-secondary-foreground'
          : 'border-border bg-background text-foreground hover:border-foreground/40',
      )}
    >
      {children}
    </Link>
  );
}

function DateRangeFilter({ state }: { state: CustomerBookACarUrlState }) {
  const router = useRouter();
  const minDate = todayIsoIst();
  const maxDate = getBookingHorizonEndIso(minDate);
  const [pickup, setPickup] = useState(state.deliveryDate ?? '');
  const [ret, setRet] = useState(state.returnDate ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPickup(state.deliveryDate ?? '');
    setRet(state.returnDate ?? '');
  }, [state.deliveryDate, state.returnDate]);

  const apply = (deliveryDate: string, returnDate: string) => {
    const message = validateBrowseDateRange(deliveryDate || null, returnDate || null);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    router.push(
      buildCustomerBookACarSearchParams(state, {
        deliveryDate: deliveryDate || null,
        returnDate: returnDate || null,
        page: 1,
      }),
      { scroll: false },
    );
  };

  const clear = () => {
    setPickup('');
    setRet('');
    setError(null);
    router.push(
      buildCustomerBookACarSearchParams(state, {
        deliveryDate: null,
        returnDate: null,
        page: 1,
      }),
      { scroll: false },
    );
  };

  return (
    <div className="space-y-2" role="group" aria-label="Booking dates filter">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Pickup
          <input
            type="date"
            value={pickup}
            min={minDate}
            max={maxDate}
            onChange={(event) => {
              const next = event.target.value;
              setPickup(next);
              if (next && ret) {
                apply(next, ret);
              }
            }}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm font-medium text-foreground normal-case"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Return
          <input
            type="date"
            value={ret}
            min={pickup || minDate}
            max={maxDate}
            onChange={(event) => {
              const next = event.target.value;
              setRet(next);
              if (pickup && next) {
                apply(pickup, next);
              }
            }}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm font-medium text-foreground normal-case"
          />
        </label>
        {state.deliveryDate && state.returnDate ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-xs font-semibold tracking-wide text-foreground uppercase hover:border-foreground/40"
          >
            Clear dates
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!state.deliveryDate || !state.returnDate ? (
        <p className="text-xs text-muted-foreground">
          Choose pickup and return to see cars free for those dates.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Showing cars available {state.deliveryDate} → {state.returnDate}.
        </p>
      )}
    </div>
  );
}

export function BookACarFilters({ state }: { state: CustomerBookACarUrlState }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Availability filter">
        {AVAILABILITY_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            active={state.availability === option.value}
            href={buildCustomerBookACarSearchParams(state, {
              availability: option.value,
              page: 1,
            })}
          >
            {option.label}
          </FilterChip>
        ))}
      </div>
      <DateRangeFilter state={state} />
    </div>
  );
}
