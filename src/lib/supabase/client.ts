import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let client: SupabaseClient<Database> | null = null;

/**
 * Singleton browser Supabase client.
 * Always returns the same instance to avoid multiple auth subscriptions
 * and lock contention between tabs/components.
 */
export function createClient(): SupabaseClient<Database> {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Default lock timeout — 5s is enough for normal operations
          lockAcquireTimeout: 5000,
          // Detect session from URL (for OAuth callback)
          detectSessionInUrl: true,
          // Persist session in cookie for SSR sync
          flowType: 'pkce',
        },
      }
    ) as unknown as SupabaseClient<Database>;
  }
  return client;
}
