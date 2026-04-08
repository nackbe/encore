import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let client: SupabaseClient<Database> | null = null;
let errorHandlerInstalled = false;

export function createClient(): SupabaseClient<Database> {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Increase lock timeout to reduce contention with concurrent requests
          lockAcquireTimeout: 15000,
        },
      }
    ) as unknown as SupabaseClient<Database>;

    // Suppress Supabase auth lock errors (non-fatal, auth still works)
    if (typeof window !== 'undefined' && !errorHandlerInstalled) {
      errorHandlerInstalled = true;
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason?.message?.includes('was released because another request stole it')) {
          event.preventDefault();
        }
      });
    }
  }
  return client;
}
