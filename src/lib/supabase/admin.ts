/**
 * Supabase service-role client for privileged server jobs (e.g. payment webhooks).
 *
 * NEVER import this from Client Components or expose the service role key.
 */

import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { supabaseConfig } from '@/lib/supabase/config';
import type { Database } from '@/types/database';

function requireServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) {
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. ' +
        'Required for privileged server operations such as payment webhooks.',
    );
  }
  return value;
}

/** Fresh service-role client (no user session cookies). */
export function createSupabaseAdminClient() {
  return createClient<Database>(supabaseConfig.url, requireServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
