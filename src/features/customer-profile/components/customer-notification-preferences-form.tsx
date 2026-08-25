'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateCustomerNotificationPreferences } from '@/features/customer-profile/actions/update-preferences';
import {
  customerNotificationPreferencesSchema,
  type CustomerNotificationPreferencesInput,
} from '@/features/customer-profile/validations/preferences';

export function CustomerNotificationPreferencesForm({
  email,
  initialPhone,
  initialWhatsAppOptIn,
}: {
  readonly email: string;
  readonly initialPhone: string | null;
  readonly initialWhatsAppOptIn: boolean;
}) {
  const errorId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerNotificationPreferencesInput>({
    resolver: zodResolver(customerNotificationPreferencesSchema),
    defaultValues: {
      phone: initialPhone ?? '',
      whatsappOptIn: initialWhatsAppOptIn,
    },
  });

  const isLoading = isSubmitting || isPending;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCustomerNotificationPreferences(values);
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      setSaved(true);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-xl gap-5">
      {formError ? (
        <Alert variant="destructive" id={errorId}>
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <Alert>
          <AlertTitle>Preferences saved</AlertTitle>
          <AlertDescription>
            Booking updates will follow these WhatsApp and email settings.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" type="email" value={email} readOnly className="bg-muted/50" />
        <p className="text-xs text-muted-foreground">
          Approval, payment, and cancellation emails are sent here after you confirm the address.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="profile-phone">WhatsApp number</Label>
        <Input
          id="profile-phone"
          type="tel"
          autoComplete="tel"
          disabled={isLoading}
          aria-invalid={Boolean(errors.phone)}
          placeholder="+91 98765 43210"
          {...register('phone')}
        />
        {errors.phone ? (
          <p className="text-sm text-destructive">{errors.phone.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Use a mobile number that can receive WhatsApp. We store it in international format.
          </p>
        )}
      </div>

      <Controller
        control={control}
        name="whatsappOptIn"
        render={({ field }) => (
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
            <Checkbox
              id="whatsapp-opt-in"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              disabled={isLoading}
              className="mt-1 size-5"
            />
            <Label htmlFor="whatsapp-opt-in" className="block leading-relaxed font-normal">
              Send booking updates on WhatsApp — request received, approval, payment, changes, and
              cancellations.
            </Label>
          </div>
        )}
      />

      <Button
        type="submit"
        disabled={isLoading}
        className="h-11 w-fit rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
      >
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : 'Save preferences'}
      </Button>
    </form>
  );
}
