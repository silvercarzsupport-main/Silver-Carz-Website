'use client';

import { useEffect } from 'react';

import { buildPasswordRecoveryCatcherHref } from '@/lib/auth/password-reset';

/**
 * Forwards leftover recovery tokens when Auth falls back to Site URL (home).
 * `/reset-password` and `/auth/callback` already handle these params themselves.
 */
export function PasswordRecoveryRedirectCatcher() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const href = buildPasswordRecoveryCatcherHref(pathname, search, hash);
    if (!href) {
      return;
    }

    window.location.replace(href);
  }, []);

  return null;
}
