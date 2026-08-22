'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { listCustomerVehicleBookedDates } from '@/features/customer-booking/actions/list-booked-dates';
import {
  buildMonthCells,
  endOfMonthIso,
  expandInclusiveDateRange,
  formatIsoMonthTitle,
  getAllowedCalendarMonths,
  isPastDate,
  rangeContainsBookedDate,
  todayIsoIst,
} from '@/features/customer-booking/lib/calendar-dates';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type CalendarView = 'current' | 'next';

export function BookingDateCalendar({
  vehicleId,
  deliveryDate,
  returnDate,
  disabled = false,
  onChange,
  onSelectionIssue,
}: {
  readonly vehicleId: string;
  readonly deliveryDate: string;
  readonly returnDate: string;
  readonly disabled?: boolean;
  readonly onChange: (next: { deliveryDate: string; returnDate: string }) => void;
  readonly onSelectionIssue?: (message: string | null) => void;
}) {
  const { currentMonth, nextMonth } = useMemo(() => getAllowedCalendarMonths(), []);
  const [view, setView] = useState<CalendarView>('current');
  const [bookedDates, setBookedDates] = useState<ReadonlySet<string>>(new Set());
  const [isLoading, startLoad] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  const visibleMonth = view === 'current' ? currentMonth : nextMonth;
  const todayIso = todayIsoIst();

  useEffect(() => {
    const fromDate = currentMonth;
    const toDate = endOfMonthIso(nextMonth);

    startLoad(async () => {
      setLoadError(null);
      const result = await listCustomerVehicleBookedDates({
        vehicleId,
        fromDate,
        toDate,
      });

      if (!result.success) {
        setLoadError(result.error.message);
        setBookedDates(new Set());
        return;
      }

      setBookedDates(new Set(result.data.bookedDates));
    });
  }, [vehicleId, currentMonth, nextMonth]);

  const selectedSet = useMemo(() => {
    if (!deliveryDate) {
      return new Set<string>();
    }
    if (!returnDate) {
      return new Set([deliveryDate]);
    }
    return new Set(expandInclusiveDateRange(deliveryDate, returnDate));
  }, [deliveryDate, returnDate]);

  const cells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);

  const handleDayClick = (isoDate: string) => {
    if (disabled || isLoading) {
      return;
    }

    if (isPastDate(isoDate) || bookedDates.has(isoDate)) {
      return;
    }

    // Fresh selection or restart after a completed range.
    if (!deliveryDate || (deliveryDate && returnDate)) {
      onChange({ deliveryDate: isoDate, returnDate: '' });
      onSelectionIssue?.(null);
      return;
    }

    // Second click — complete the range.
    if (isoDate < deliveryDate) {
      if (rangeContainsBookedDate(isoDate, deliveryDate, bookedDates)) {
        onSelectionIssue?.(
          'Your selection includes unavailable dates. Please choose another range.',
        );
        onChange({ deliveryDate: isoDate, returnDate: '' });
        return;
      }
      onChange({ deliveryDate: isoDate, returnDate: deliveryDate });
      onSelectionIssue?.(null);
      return;
    }

    if (rangeContainsBookedDate(deliveryDate, isoDate, bookedDates)) {
      onSelectionIssue?.('Your selection includes unavailable dates. Please choose another range.');
      return;
    }

    onChange({ deliveryDate, returnDate: isoDate });
    onSelectionIssue?.(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-md px-2"
          disabled={disabled || isLoading || view === 'current'}
          onClick={() => setView('current')}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-bold tracking-wide text-foreground uppercase">
            {formatIsoMonthTitle(visibleMonth)}
          </p>
          <p className="text-xs text-muted-foreground">
            {view === 'current' ? 'This month' : 'Next month'} · Tap pickup, then return
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-md px-2"
          disabled={disabled || isLoading || view === 'next'}
          onClick={() => setView('next')}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Checking availability…
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-1 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {day}
              </div>
            ))}
          </div>

          <div
            className="grid grid-cols-7 gap-1.5 sm:gap-2"
            role="grid"
            aria-label="Availability calendar"
          >
            {cells.map((cell, index) => {
              if (!cell.isoDate || cell.dayNumber == null) {
                return <div key={`empty-${index}`} className="aspect-square" aria-hidden="true" />;
              }

              const iso = cell.isoDate;
              const past = isPastDate(iso);
              const booked = bookedDates.has(iso);
              const selected = selectedSet.has(iso);
              const isToday = iso === todayIso;
              const isStart = iso === deliveryDate;
              const isEnd = Boolean(returnDate) && iso === returnDate;
              const clickable = !disabled && !past && !booked;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!clickable}
                  onClick={() => handleDayClick(iso)}
                  aria-label={`${iso}${booked ? ', unavailable' : selected ? ', selected' : ', available'}`}
                  aria-pressed={selected}
                  className={cn(
                    'aspect-square rounded-md border text-sm font-semibold transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    past &&
                      !booked &&
                      'cursor-not-allowed border-transparent bg-muted/40 text-muted-foreground/50',
                    booked &&
                      'cursor-not-allowed border-destructive bg-destructive text-destructive-foreground shadow-sm',
                    !past &&
                      !booked &&
                      !selected &&
                      'border-border bg-background text-foreground hover:border-foreground/40 hover:bg-muted/40',
                    selected && 'border-success bg-success text-success-foreground shadow-sm',
                    isToday && !selected && !booked && !past && 'ring-1 ring-primary',
                    (isStart || isEnd) && selected && 'ring-2 ring-success-foreground/40',
                  )}
                >
                  {cell.dayNumber}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <LegendSwatch className="border-border bg-background" label="Available" />
        <LegendSwatch className="border-destructive bg-destructive" label="Booked / unavailable" />
        <LegendSwatch className="border-success bg-success" label="Your selection" />
        <LegendSwatch className="border-transparent bg-muted/40" label="Past dates" />
      </ul>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  readonly className: string;
  readonly label: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn('size-3.5 rounded-sm border', className)} aria-hidden="true" />
      <span>{label}</span>
    </li>
  );
}
