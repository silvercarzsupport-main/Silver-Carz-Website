'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/constants/routes';
import { customerSignInAction } from '@/features/customer-auth/actions/sign-in';
import {
  signInCredentialsSchema,
  type SignInCredentials,
} from '@/features/customer-auth/validations/credentials';
import { cn } from '@/lib/utils';

interface CustomerLoginFormProps {
  readonly nextPath?: string;
  readonly initialError?: string;
  readonly initialSuccess?: string;
  readonly className?: string;
}

export function CustomerLoginForm({
  nextPath,
  initialError,
  initialSuccess,
  className,
}: CustomerLoginFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const successId = useId();

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInCredentials>({
    resolver: zodResolver(signInCredentialsSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onSubmit',
  });

  const isLoading = isSubmitting || isPending;

  const signupHref = nextPath
    ? `${ROUTES.customerSignup}?${new URLSearchParams({ next: nextPath }).toString()}`
    : ROUTES.customerSignup;

  const forgotHref = nextPath
    ? `${ROUTES.customerForgotPassword}?${new URLSearchParams({ next: nextPath }).toString()}`
    : ROUTES.customerForgotPassword;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);

    startTransition(async () => {
      const result = await customerSignInAction(values, nextPath);

      if (result && !result.success) {
        setFormError(result.error.message);
      }
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn('grid gap-4', className)}
      aria-describedby={formError ? errorId : initialSuccess ? successId : undefined}
    >
      {formError ? (
        <Alert variant="destructive" id={errorId}>
          <AlertTitle>Sign in failed</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {!formError && initialSuccess ? (
        <Alert variant="success" id={successId}>
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>{initialSuccess}</AlertDescription>
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

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={passwordId}>Password</Label>
          <Link
            href={forgotHref}
            className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            className="h-11 rounded-md pr-10"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? `${passwordId}-error` : undefined}
            disabled={isLoading}
            {...register('password')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={isLoading}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {errors.password ? (
          <p id={`${passwordId}-error`} className="text-sm text-destructive" role="alert">
            {errors.password.message}
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
            Signing in…
          </>
        ) : (
          'Log in'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to Silver Carz?{' '}
        <Link
          href={signupHref}
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
