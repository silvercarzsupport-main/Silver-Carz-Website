'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/constants/routes';
import { requestPasswordResetAction } from '@/features/customer-auth/actions/request-password-reset';
import {
  resetPasswordRequestSchema,
  type ResetPasswordRequest,
} from '@/features/customer-auth/validations/credentials';
import { PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE } from '@/lib/auth/password-reset';
import { cn } from '@/lib/utils';

interface CustomerForgotPasswordFormProps {
  readonly resumePath?: string;
  readonly initialError?: string;
  readonly className?: string;
}

export function CustomerForgotPasswordForm({
  resumePath,
  initialError,
  className,
}: CustomerForgotPasswordFormProps) {
  const emailId = useId();
  const errorId = useId();
  const successId = useId();

  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordRequest>({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: { email: '' },
    mode: 'onSubmit',
  });

  const isLoading = isSubmitting || isPending;

  const loginHref = resumePath
    ? `${ROUTES.customerLogin}?${new URLSearchParams({ next: resumePath }).toString()}`
    : ROUTES.customerLogin;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await requestPasswordResetAction(values.email, resumePath);

      if (!result.success) {
        setFormError(result.error.message);
        return;
      }

      setSuccessMessage(PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE);
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn('grid gap-4', className)}
      aria-describedby={formError ? errorId : successMessage ? successId : undefined}
    >
      {formError ? (
        <Alert variant="destructive" id={errorId}>
          <AlertTitle>Reset email could not be sent</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert variant="success" id={successId}>
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
          disabled={isLoading}
          className="h-11 rounded-md"
          {...register('email')}
        />
        {errors.email ? (
          <p id={`${emailId}-error`} className="text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Sending link…
          </>
        ) : (
          'Send reset link'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered your password?{' '}
        <Link
          href={loginHref}
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
