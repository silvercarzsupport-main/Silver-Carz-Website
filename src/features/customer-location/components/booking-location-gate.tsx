'use client';

import { Loader2, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DEFAULT_FLEET_CITY } from '@/config/fleet-cities';
import { setBookingCity } from '@/features/customer-location/actions/set-booking-city';
import { CitySearchSelect } from '@/components/shared/city-search-select';

export function BookingLocationGate({ bookingCity }: { readonly bookingCity: string | null }) {
  const router = useRouter();
  const defaultCity = bookingCity ?? DEFAULT_FLEET_CITY;

  const [changeOpen, setChangeOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(defaultCity);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mandatory = !bookingCity;
  const open = mandatory || changeOpen;

  function resetDialogState() {
    setErrorMessage(null);
    setSelectedCity(defaultCity);
  }

  function onOpenChange(nextOpen: boolean) {
    if (mandatory) {
      return;
    }

    if (nextOpen) {
      resetDialogState();
    }

    setChangeOpen(nextOpen);
  }

  function confirmCity() {
    setErrorMessage(null);

    startTransition(async () => {
      const result = await setBookingCity(selectedCity);
      if (!result.success) {
        setErrorMessage(result.error.message);
        return;
      }

      router.refresh();
      setChangeOpen(false);
      setErrorMessage(null);
    });
  }

  return (
    <>
      {bookingCity ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Showing cars in <span className="font-semibold">{bookingCity}</span>
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-md"
            onClick={() => {
              resetDialogState();
              setChangeOpen(true);
            }}
          >
            Change city
          </Button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={!mandatory}
          className="sm:max-w-md"
          onPointerDownOutside={(event) => {
            if (mandatory) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (mandatory) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight uppercase">
              {mandatory ? 'Choose your city' : 'Change booking city'}
            </DialogTitle>
            <DialogDescription>
              Select the city in India where you want to pick up your car.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="booking-city">City of booking</Label>
            <CitySearchSelect
              id="booking-city"
              value={selectedCity}
              onValueChange={(city) => {
                setSelectedCity(city);
                setErrorMessage(null);
              }}
              disabled={isPending}
              placeholder="Select your city"
            />
            {errorMessage ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <DialogFooter className="sm:justify-end">
            {!mandatory ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-md"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="button"
              className="rounded-md font-semibold"
              onClick={confirmCity}
              disabled={isPending || !selectedCity}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Continue with {selectedCity || 'city'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
