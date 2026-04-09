/**
 * Clean up Wikipedia-sourced events from Supabase before re-loading.
 *
 * Deletes in reverse dependency order:
 *   1. global_event_artists (links) for Wikipedia events
 *   2. global_events where source='wikipedia'
 *   3. Artists are NOT deleted (shared resource, just missing images)
 *
 * Usage: npx tsx scripts/seed/run-cleanup.ts [--dry-run]
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '..', '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('╔══════════════════════════════════════╗');
  console.log('║  Encore — Cleanup Wikipedia Events   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Test connection
  const { error: testError } = await supabase.from('global_events').select('id').limit(1);
  if (testError) {
    console.error('Supabase connection failed:', testError.message);
    process.exit(1);
  }
  console.log('✓ Supabase connected\n');

  // Count current state
  const { count: eventCount } = await supabase
    .from('global_events')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'wikipedia');

  console.log(`Wikipedia events in DB: ${eventCount ?? 0}`);

  if (!eventCount || eventCount === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  // Get all Wikipedia event IDs (batch by 1000)
  const eventIds: string[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('global_events')
      .select('id')
      .eq('source', 'wikipedia')
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    eventIds.push(...data.map(e => e.id));
    from += data.length;
    if (data.length < 1000) break;
  }
  console.log(`Event IDs collected: ${eventIds.length}`);

  // Count links
  let linkCount = 0;
  for (let i = 0; i < eventIds.length; i += 500) {
    const batch = eventIds.slice(i, i + 500);
    const { count } = await supabase
      .from('global_event_artists')
      .select('*', { count: 'exact', head: true })
      .in('global_event_id', batch);
    linkCount += count ?? 0;
  }
  console.log(`Artist-event links to delete: ${linkCount}`);

  if (dryRun) {
    console.log('\nDRY RUN — would delete:');
    console.log(`  ${linkCount} global_event_artists links`);
    console.log(`  ${eventIds.length} global_events`);
    console.log('  0 artists (kept)');
    return;
  }

  // Step 1: Delete links in batches
  console.log('\n--- Step 1: Deleting artist-event links ---');
  let deletedLinks = 0;
  for (let i = 0; i < eventIds.length; i += 500) {
    const batch = eventIds.slice(i, i + 500);
    const { error } = await supabase
      .from('global_event_artists')
      .delete()
      .in('global_event_id', batch);
    if (error) {
      console.error(`  Error at batch ${i}: ${error.message}`);
    } else {
      deletedLinks += batch.length; // approximate
      process.stdout.write(`\r  Processed: ${Math.min(i + 500, eventIds.length)}/${eventIds.length} event batches`);
    }
  }
  console.log('\n  Links deleted ✓');

  // Step 2: Delete events in batches
  console.log('\n--- Step 2: Deleting Wikipedia events ---');
  let deletedEvents = 0;
  for (let i = 0; i < eventIds.length; i += 500) {
    const batch = eventIds.slice(i, i + 500);
    const { error } = await supabase
      .from('global_events')
      .delete()
      .in('id', batch);
    if (error) {
      console.error(`  Error at batch ${i}: ${error.message}`);
    } else {
      deletedEvents += batch.length;
      process.stdout.write(`\r  Deleted: ${deletedEvents}/${eventIds.length}`);
    }
  }
  console.log('\n  Events deleted ✓');

  // Verify
  const { count: remaining } = await supabase
    .from('global_events')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'wikipedia');

  const { count: artistCount } = await supabase
    .from('artists')
    .select('*', { count: 'exact', head: true });

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║         Cleanup Complete             ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Wikipedia events remaining: ${remaining ?? 0}`);
  console.log(`  Artists preserved: ${artistCount ?? 0}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
