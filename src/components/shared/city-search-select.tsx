'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { INDIAN_CITIES } from '@/config/indian-cities';
import { cn } from '@/lib/utils';

export function CitySearchSelect({
  id,
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Search or select a city',
  extraOptions = [],
  invalid = false,
  describedBy,
}: {
  readonly id: string;
  readonly value: string;
  readonly onValueChange: (city: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly extraOptions?: readonly string[];
  readonly invalid?: boolean;
  readonly describedBy?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const allCities = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const city of [...extraOptions, ...INDIAN_CITIES]) {
      const trimmed = city.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      merged.push(trimmed);
    }

    return merged.sort((left, right) => left.localeCompare(right, 'en-IN'));
  }, [extraOptions]);

  const filteredCities = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return allCities;
    }

    return allCities.filter((city) => city.toLowerCase().includes(trimmed));
  }, [allCities, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function selectCity(city: string) {
    onValueChange(city);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        id={id}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        className={cn(
          'h-11 w-full justify-between rounded-md font-normal',
          invalid && 'border-destructive ring-destructive/20',
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>
          {value || placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      </Button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
          <div className="border-b border-border p-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to search cities…"
              autoFocus
              className="h-9"
              aria-controls={`${id}-listbox`}
            />
          </div>
          <ul
            id={`${id}-listbox`}
            role="listbox"
            aria-label="Indian cities"
            className="max-h-60 overflow-y-auto p-1"
          >
            {filteredCities.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                No cities match your search.
              </li>
            ) : (
              filteredCities.map((city) => {
                const selected = city === value;

                return (
                  <li key={city} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                        selected && 'bg-accent text-accent-foreground',
                      )}
                      onClick={() => selectCity(city)}
                    >
                      <Check
                        className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                        aria-hidden="true"
                      />
                      <span className="truncate">{city}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {allCities.length} cities available
          </p>
        </div>
      ) : null}
    </div>
  );
}
