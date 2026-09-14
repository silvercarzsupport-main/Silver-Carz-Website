import 'server-only';

import { cookies } from 'next/headers';

import { STORAGE_KEYS } from '@/constants';
import { getPasswordRecoveryCookieOptions } from '@/lib/auth/password-reset';

/** Marks the current session as a password-recovery exchange (20 minutes). */
export async function setPasswordRecoveryCookie(): Promise<void> {
  const store = await cookies();
  store.set(STORAGE_KEYS.passwordRecovery, '1', {
    ...getPasswordRecoveryCookieOptions(process.env.NODE_ENV === 'production'),
  });
}

export async function clearPasswordRecoveryCookie(): Promise<void> {
  const store = await cookies();
  store.delete(STORAGE_KEYS.passwordRecovery);
}

export async function hasPasswordRecoveryCookie(): Promise<boolean> {
  const store = await cookies();
  return store.get(STORAGE_KEYS.passwordRecovery)?.value === '1';
}
