import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/constants/routes';
import { customerResetPasswordSchema } from '@/features/customer-auth/validations/credentials';
import {
  buildPasswordResetRedirectTo,
  buildPasswordUpdatedLoginPath,
  isVisiblePasswordResetRequestError,
  readRecoveryHash,
  resolveAuthCallbackDestination,
  resolvePublicAppOrigin,
  resolveResumePath,
} from '@/lib/auth/password-reset';
import { isCustomerAuthRoute, isSafeCustomerRedirectPath } from '@/lib/auth/route-guards';

describe('customer password reset helpers', () => {
  it('uses NEXT_PUBLIC_APP_URL origin and ignores a trailing slash', () => {
    expect(resolvePublicAppOrigin('https://silver-carz-website.vercel.app/')).toBe(
      'https://silver-carz-website.vercel.app',
    );
  });

  it('falls back to localhost when the env URL is missing or unsafe', () => {
    expect(resolvePublicAppOrigin(undefined)).toBe('http://localhost:3000');
    expect(resolvePublicAppOrigin('javascript:alert(1)')).toBe('http://localhost:3000');
    expect(resolvePublicAppOrigin('not-a-url')).toBe('http://localhost:3000');
  });

  it('builds a callback redirectTo that cannot leave the customer portal', () => {
    const url = new URL(
      buildPasswordResetRedirectTo('https://example.com', '/booking/continue?vehicle=1'),
    );

    expect(url.origin).toBe('https://example.com');
    expect(url.pathname).toBe(ROUTES.authCallback);
    expect(url.searchParams.get('next')).toBe(ROUTES.customerResetPassword);
    expect(url.searchParams.get('resume')).toBe('/booking/continue?vehicle=1');

    expect(buildPasswordResetRedirectTo('https://example.com', 'https://evil.com')).toBe(
      'https://example.com/auth/callback?next=%2Freset-password',
    );
  });

  it('sends recovery traffic to the reset form and rejects open redirects', () => {
    expect(
      resolveAuthCallbackDestination({
        next: ROUTES.customerResetPassword,
        resume: '/my-bookings',
        type: 'recovery',
        error: null,
      }),
    ).toBe(`${ROUTES.customerResetPassword}?resume=%2Fmy-bookings`);

    expect(
      resolveAuthCallbackDestination({
        next: 'https://evil.com',
        resume: null,
        type: null,
        error: null,
      }),
    ).toBe(ROUTES.customerResetPassword);

    expect(
      resolveAuthCallbackDestination({
        next: null,
        resume: null,
        type: null,
        error: 'access_denied',
      }),
    ).toBe(`${ROUTES.customerForgotPassword}?reason=recovery_invalid`);
  });

  it('parses implicit-flow recovery hashes and ignores other fragments', () => {
    expect(
      readRecoveryHash('#access_token=aaa&refresh_token=bbb&type=recovery&expires_in=3600'),
    ).toEqual({ accessToken: 'aaa', refreshToken: 'bbb' });

    expect(readRecoveryHash('#access_token=aaa&type=signup')).toBeNull();
    expect(readRecoveryHash('')).toBeNull();
  });

  it('keeps forgot-password as an auth screen and reset-password reachable while signed in', () => {
    expect(isCustomerAuthRoute(ROUTES.customerForgotPassword)).toBe(true);
    expect(isCustomerAuthRoute(ROUTES.customerResetPassword)).toBe(false);
    expect(isSafeCustomerRedirectPath(ROUTES.customerResetPassword)).toBe(true);
    expect(resolveResumePath('/admin/dashboard')).toBeUndefined();
  });

  it('builds the post-update login URL and only surfaces rate-limit errors', () => {
    expect(buildPasswordUpdatedLoginPath('/profile')).toBe(
      `${ROUTES.customerLogin}?reset=success&next=%2Fprofile`,
    );
    expect(isVisiblePasswordResetRequestError('over_email_send_rate_limit')).toBe(true);
    expect(isVisiblePasswordResetRequestError('user_not_found')).toBe(false);
  });

  it('enforces the same password rules as signup', () => {
    expect(
      customerResetPasswordSchema.safeParse({
        password: 'Short1!',
        confirmPassword: 'Short1!',
      }).success,
    ).toBe(false);

    expect(
      customerResetPasswordSchema.safeParse({
        password: 'ValidPass1!',
        confirmPassword: 'Different1!',
      }).success,
    ).toBe(false);

    expect(
      customerResetPasswordSchema.safeParse({
        password: 'ValidPass1!',
        confirmPassword: 'ValidPass1!',
      }).success,
    ).toBe(true);
  });
});
