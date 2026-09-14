'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/constants/routes';
import { establishPasswordRecoveryAction } from '@/features/customer-auth/actions/establish-password-recovery';
import { updatePasswordAction } from '@/features/customer-auth/actions/update-password';
import { PasswordStrength } from '@/features/customer-auth/components/password-strength';
import {
  customerResetPasswordSchema,
  type CustomerResetPasswordInput,
} from '@/features/customer-auth/validations/credentials';
import { AUTH_ERROR_CODES, getAuthErrorMessageForCode } from '@/lib/auth/errors';
import { readRecoveryHash } from '@/lib/auth/password-reset';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface CustomerResetPasswordViewProps {
  readonly canUpdate: boolean;
  readonly resumePath?: string;
  readonly className?: string;
}

type Gate = 'checking' | 'ready' | 'invalid';

function forgotHref(resumePath?: string): string {
  if (!resumePath) {
    return ROUTES.customerForgotPassword;
  }

  return `${ROUTES.customerForgotPassword}?${new URLSearchParams({ next: resumePath }).toString()}`;
}

function loginHref(resumePath?: string): string {
  if (!resumePath) {
    return ROUTES.customerLogin;
  }

  return `${ROUTES.customerLogin}?${new URLSearchParams({ next: resumePath }).toString()}`;
}

function callbackHrefFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.get('next')) {
    params.set('next', ROUTES.customerResetPassword);
  }
  return `${ROUTES.authCallback}?${params.toString()}`;
}

/**
 * Confirms a recovery session (PKCE query or implicit hash), then collects a new password.
 */
export function CustomerResetPasswordView({
  canUpdate,
  resumePath,
  className,
}: CustomerResetPasswordViewProps) {
  const router = useRouter();
  const [clientGate, setClientGate] = useState<Gate>('checking');
  const gate: Gate = canUpdate ? 'ready' : clientGate;

  useEffect(() => {
    if (canUpdate) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      const { search, hash, pathname } = window.location;
      const params = new URLSearchParams(search);
      const code = params.get('code');
      const tokenHash = params.get('token_hash');

      if (code || tokenHash) {
        window.location.replace(callbackHrefFromSearch(search));
        return;
      }

      const tokens = readRecoveryHash(hash);
      if (!tokens) {
        setClientGate('invalid');
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (cancelled) {
        return;
      }

      if (error) {
        setClientGate('invalid');
        return;
      }

      const result = await establishPasswordRecoveryAction();
      if (cancelled) {
        return;
      }

      if (!result.success) {
        setClientGate('invalid');
        return;
      }

      window.history.replaceState(null, '', `${pathname}${search}`);
      setClientGate('ready');
      router.refresh();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [canUpdate, router]);

  if (gate === 'checking') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Opening your reset link…
      </p>
    );
  }

  if (gate === 'invalid') {
    return (
      <div className="grid gap-4">
        <Alert variant="destructive">
          <AlertTitle>Reset link expired</AlertTitle>
          <AlertDescription>
            {getAuthErrorMessageForCode(AUTH_ERROR_CODES.recoveryInvalid)}
          </AlertDescription>
        </Alert>
        <Button
          asChild
          size="lg"
          className="h-11 w-full rounded-md bg-primary font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
        >
          <Link href={forgotHref(resumePath)}>Request a new link</Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href={loginHref(resumePath)}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Back to login
          </Link>
        </p>
      </div>
    );
  }

  return <CustomerResetPasswordForm resumePath={resumePath} className={className} />;
}

function CustomerResetPasswordForm({
  resumePath,
  className,
}: {
  readonly resumePath?: string;
  readonly className?: string;
}) {
  const passwordId = useId();
  const confirmPasswordId = useId();
  const passwordCriteriaId = useId();
  const passwordMeterId = useId();
  const errorId = useId();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerResetPasswordInput>({
    resolver: zodResolver(customerResetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onSubmit',
  });

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' }) ?? '';
  const isLoading = isSubmitting || isPending;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);

    startTransition(async () => {
      const result = await updatePasswordAction(values, resumePath);

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
      aria-describedby={formError ? errorId : undefined}
    >
      {formError ? (
        <Alert variant="destructive" id={errorId}>
          <AlertTitle>Password could not be updated</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={passwordId}>New password</Label>
        <div className="relative">
          <Input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Create a strong password"
            className="h-11 rounded-md pr-10"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password
                ? `${passwordId}-error ${passwordCriteriaId} ${passwordMeterId}`
                : `${passwordCriteriaId} ${passwordMeterId}`
            }
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
        <PasswordStrength
          password={passwordValue}
          criteriaId={passwordCriteriaId}
          meterId={passwordMeterId}
        />
        {errors.password ? (
          <p id={`${passwordId}-error`} className="text-sm text-destructive" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={confirmPasswordId}>Confirm new password</Label>
        <div className="relative">
          <Input
            id={confirmPasswordId}
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="h-11 rounded-md pr-10"
            aria-invalid={errors.confirmPassword ? true : undefined}
            aria-describedby={errors.confirmPassword ? `${confirmPasswordId}-error` : undefined}
            disabled={isLoading}
            {...register('confirmPassword')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfirmPassword((current) => !current)}
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            disabled={isLoading}
          >
            {showConfirmPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {errors.confirmPassword ? (
          <p id={`${confirmPasswordId}-error`} className="text-sm text-destructive" role="alert">
            {errors.confirmPassword.message}
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
            Updating password…
          </>
        ) : (
          'Update password'
        )}
      </Button>
    </form>
  );
}
