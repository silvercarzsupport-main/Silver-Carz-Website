import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/constants/routes';
import { customerResetPasswordSchema } from '@/features/customer-auth/validations/credentials';
import {
  buildPasswordRecoveryCatcherHref,
  buildPasswordRecoveryProxyHref,
  buildPasswordResetRedirectTo,
  buildPasswordUpdatedLoginPath,
  isAllowedAppOrigin,
  isVisiblePasswordResetRequestError,
  readRecoveryHash,
  resolveAuthCallbackDestination,
  resolvePublicAppOrigin,
  resolveRequestAppOrigin,
  resolveResumePath,
  shouldMarkPasswordRecovery,
} from '@/lib/auth/password-reset';
import { isCustomerAuthRoute, isSafeCustomerRedirectPath } from '@/lib/auth/route-guards';

describe('customer password reset helpers', () => {
  it('uses NEXT_PUBLIC_APP_URL origin and ignores a trailing slash', () => {
    expect(resolvePublicAppOrigin('https://silver-carz-website.vercel.app/')).toBe(
      'https://silver-carz-website.vercel.app',
    );
  });

  it('falls back to localhost when the env URL is missing or unsafe', () => {
    expect(resolvePublicAppOrigin(undefined, undefined, undefined)).toBe('http://localhost:3000');
    expect(resolvePublicAppOrigin('javascript:alert(1)', undefined, undefined)).toBe(
      'http://localhost:3000',
    );
    expect(resolvePublicAppOrigin('not-a-url', undefined, undefined)).toBe('http://localhost:3000');
  });

  it('accepts a bare Vercel host when NEXT_PUBLIC_APP_URL is unset', () => {
    expect(resolvePublicAppOrigin(undefined, undefined, 'silver-carz-website.vercel.app')).toBe(
      'https://silver-carz-website.vercel.app',
    );
  });

  it('uses the request origin only when it matches a known app host', () => {
    const headers = new Headers({
      'x-forwarded-host': 'silver-carz-website.vercel.app',
      'x-forwarded-proto': 'https',
    });

    expect(
      resolveRequestAppOrigin(
        headers,
        'http://localhost:3000',
        'silver-carz-website.vercel.app',
        'silver-carz-website.vercel.app',
      ),
    ).toBe('https://silver-carz-website.vercel.app');

    expect(
      resolveRequestAppOrigin(
        new Headers({ host: 'evil.example' }),
        'http://localhost:3000',
        undefined,
        undefined,
      ),
    ).toBe('http://localhost:3000');

    expect(
      isAllowedAppOrigin('https://evil.example', 'http://localhost:3000', undefined, undefined),
    ).toBe(false);
  });

  it('builds a path-only redirectTo so Redirect URLs can match without a query string', () => {
    const url = new URL(
      buildPasswordResetRedirectTo('https://example.com', '/booking/continue?vehicle=1'),
    );

    expect(url.origin).toBe('https://example.com');
    expect(url.pathname).toBe(ROUTES.customerResetPassword);
    expect(url.searchParams.get('next')).toBeNull();
    expect(url.searchParams.get('resume')).toBe('/booking/continue?vehicle=1');

    expect(buildPasswordResetRedirectTo('https://example.com', 'https://evil.com')).toBe(
      'https://example.com/reset-password',
    );
  });

  it('forwards leftover recovery tokens away from the homepage', () => {
    expect(buildPasswordRecoveryProxyHref('/', new URLSearchParams('code=abc123'))).toBe(
      `${ROUTES.authCallback}?code=abc123&next=%2Freset-password`,
    );

    expect(buildPasswordRecoveryCatcherHref('/', '?code=abc123', '')).toBe(
      `${ROUTES.authCallback}?code=abc123&next=%2Freset-password`,
    );

    expect(
      buildPasswordRecoveryCatcherHref(
        '/',
        '',
        '#access_token=aaa&refresh_token=bbb&type=recovery',
      ),
    ).toBe(`${ROUTES.customerResetPassword}#access_token=aaa&refresh_token=bbb&type=recovery`);

    expect(
      buildPasswordRecoveryCatcherHref(ROUTES.customerResetPassword, '?code=abc', ''),
    ).toBeNull();
  });

  it('marks recovery whenever the destination is the reset form', () => {
    expect(
      shouldMarkPasswordRecovery({
        type: null,
        next: null,
        destination: ROUTES.customerResetPassword,
      }),
    ).toBe(true);

    expect(
      shouldMarkPasswordRecovery({
        type: 'signup',
        next: null,
        destination: ROUTES.customerLogin,
      }),
    ).toBe(false);
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

  it('keeps forgot-password and reset-password reachable while signed in', () => {
    expect(isCustomerAuthRoute(ROUTES.customerForgotPassword)).toBe(false);
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
