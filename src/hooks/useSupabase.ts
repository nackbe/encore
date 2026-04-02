'use client';

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a memoized browser Supabase client instance.
 * Use this hook in client components to interact with Supabase.
 */
export function useSupabase(): SupabaseClient<Database> {
  const client = useMemo(() => createClient(), []);
  return client;
}
