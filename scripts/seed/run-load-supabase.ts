/**
 * Load festival lineup data from Wikipedia pipeline into Supabase.
 *
 * Strategy (optimized for speed):
 *   Phase 1: Bulk insert all unique artists
 *   Phase 2: Bulk insert all festival-year events
 *   Phase 3: Bulk insert all artist↔event links
 *
 * Usage: npx tsx scripts/seed/run-load-supabase.ts [--dry-run] [--limit N]
 *
 * Input: scripts/seed/data/festival-lineups.json
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve, join } from 'path';
config({ path: resolve(__dirname, '..', '..', '.env.local') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import { readFileSync, existsSync } from 'fs';
import type { FestivalLineup } from './crawlers/wikipedia-lineup-parser';

// ─── Config ──────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    limit: (() => {
      const idx = args.indexOf('--limit');
      return idx !== -1 ? parseInt(args[idx + 1], 10) : Infinity;
    })(),
  };
}

function normalize(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

let supabase: SupabaseClient<Database>;

// ─── Phase 1: Bulk Artists ──────────────────────────────────

async function loadArtists(festivals: FestivalLineup[]): Promise<Map<string, string>> {
  console.log('\n═══ Phase 1: Artists ═══\n');

  // Collect all unique artist names
  const uniqueArtists = new Map<string, string>(); // normalized → original name
  for (const f of festivals) {
    for (const y of f.years) {
      for (const a of y.artists) {
        const key = normalize(a.name);
        if (!uniqueArtists.has(key)) {
          uniqueArtists.set(key, a.name);
        }
      }
    }
  }
  console.log(`  Unique artists to load: ${uniqueArtists.size}`);

  // Check which already exist
  const artistMap = new Map<string, string>(); // normalized → uuid
  const allKeys = [...uniqueArtists.keys()];

  // Fetch existing in batches of 500
  let existingCount = 0;
  for (let i = 0; i < allKeys.length; i += 500) {
    const batch = allKeys.slice(i, i + 500);
    const { data: existing } = await supabase
      .from('artists').select('id, name_normalized')
      .in('name_normalized', batch);

    if (existing) {
      for (const a of existing) {
        artistMap.set(a.name_normalized, a.id);
        existingCount++;
      }
    }
  }
  console.log(`  Already exist: ${existingCount}`);

  // Insert missing in batches of 200
  const toInsert = allKeys.filter(k => !artistMap.has(k));
  console.log(`  To insert: ${toInsert.length}`);

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200).map(key => ({
      name: uniqueArtists.get(key)!,
      name_normalized: key,
      genres: [] as string[],
    }));

    const { data, error } = await supabase
      .from('artists').insert(batch).select('id, name_normalized');

    if (error) {
      // Fall back to individual inserts on conflict
      for (const item of batch) {
        try {
          const { data: single } = await supabase
            .from('artists').insert(item).select('id, name_normalized').single();
          if (single) {
            artistMap.set(single.name_normalized, single.id);
            inserted++;
          }
        } catch {
          // Try to fetch if insert fails (duplicate)
          const { data: existing } = await supabase
            .from('artists').select('id')
            .eq('name_normalized', item.name_normalized).limit(1).single();
          if (existing) artistMap.set(item.name_normalized, existing.id);
        }
      }
    } else if (data) {
      for (const a of data) {
        artistMap.set(a.name_normalized, a.id);
      }
      inserted += data.length;
    }

    if ((i + inserted) % 1000 === 0 || i + 200 >= toInsert.length) {
      process.stdout.write(`\r  Inserted: ${inserted}/${toInsert.length}`);
    }
  }
  console.log(`\n  Artists ready: ${artistMap.size}`);
  return artistMap;
}

// ─── Phase 2: Bulk Events ───────────────────────────────────

interface EventRecord {
  festivalIdx: number;
  yearIdx: number;
  sourceId: string;
  year: number;
}

async function loadEvents(
  festivals: FestivalLineup[]
): Promise<Map<string, string>> {
  console.log('\n═══ Phase 2: Festival Events ═══\n');

  // Build all event records — edition-aware source IDs for multi-city festivals
  const allEvents: EventRecord[] = [];
  for (let fi = 0; fi < festivals.length; fi++) {
    const f = festivals[fi];
    for (let yi = 0; yi < f.years.length; yi++) {
      const yl = f.years[yi];
      // Include edition in source_id to keep multi-city editions separate
      const edSuffix = yl.edition ? `:${yl.edition.toLowerCase().replace(/\s+/g, '-')}` : '';
      allEvents.push({
        festivalIdx: fi,
        yearIdx: yi,
        sourceId: `wiki:${f.pageId}:${yl.year}${edSuffix}`,
        year: yl.year,
      });
    }
  }
  console.log(`  Total festival-years: ${allEvents.length}`);

  // Check which already exist
  const eventMap = new Map<string, string>(); // sourceId → uuid
  const allSourceIds = allEvents.map(e => e.sourceId);

  for (let i = 0; i < allSourceIds.length; i += 500) {
    const batch = allSourceIds.slice(i, i + 500);
    const { data: existing } = await supabase
      .from('global_events').select('id, source_id')
      .eq('source', 'wikipedia')
      .in('source_id', batch);

    if (existing) {
      for (const e of existing) {
        if (e.source_id) eventMap.set(e.source_id, e.id);
      }
    }
  }
  console.log(`  Already exist: ${eventMap.size}`);

  // Insert missing in batches of 100
  const toInsert = allEvents.filter(e => !eventMap.has(e.sourceId));
  console.log(`  To insert: ${toInsert.length}`);

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100).map(e => {
      const f = festivals[e.festivalIdx];
      const yl = f.years[e.yearIdx];

      // Find ALL insights for this year — pick the best for the badge, concatenate top ones for desc
      // Priority: artist-centric > festival records > attendance > other
      // Priority: artist-centric celebratory > festival records > attendance
      const INSIGHT_PRIORITY: Record<string, number> = {
        iconic_set: 10, last_performance: 9, comeback: 8,
        surprise_guest: 7, collaboration: 7, tribute: 6,
        debut: 5, record: 4, attendance: 3,
        first_edition: 2, notable_moment: 2,
        venue: 1, ticket_price: 1, duration: 0,
      };

      let insightType: string | null = null;
      let insightTitle: string | null = null;
      let insightDesc: string | null = null;

      if (f.insights) {
        // Gather all insights for this year (or year-less insights that apply globally)
        const yearInsights = f.insights.filter(ins =>
          ins.year === e.year || (!ins.year && !ins.edition)
        );
        // Also include edition-specific insights
        if (yl.edition) {
          const edInsights = f.insights.filter(ins => ins.edition === yl.edition);
          yearInsights.push(...edInsights);
        }

        if (yearInsights.length > 0) {
          // Sort by priority (highest first)
          yearInsights.sort((a, b) => (INSIGHT_PRIORITY[b.type] ?? 0) - (INSIGHT_PRIORITY[a.type] ?? 0));

          // Best insight for the badge
          const best = yearInsights[0];
          insightType = best.type;
          // Format title: include artist name if available
          const typeLabel = best.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          insightTitle = best.artistName ? `${typeLabel}: ${best.artistName}` : typeLabel;

          // Concatenate top 3 insights for a richer description
          const topInsights = yearInsights.slice(0, 3);
          insightDesc = topInsights.map(ins => {
            const prefix = ins.artistName ? `[${ins.artistName}] ` : '';
            return `${prefix}${ins.text}`;
          }).join(' | ');

          // Truncate if too long (DB likely has a limit)
          if (insightDesc.length > 500) {
            insightDesc = insightDesc.substring(0, 497) + '...';
          }
        }
      }

      const wikiUrl = `https://${f.lang}.wikipedia.org/wiki/${encodeURIComponent(f.sourcePage.replace(/ /g, '_'))}`;

      // Per-year location (multi-city) > festival-level location (single-city)
      const yearLoc = yl.location;
      const festLoc = f.location;

      // Event name: include edition for multi-city festivals (e.g., "Rock in Rio Lisboa")
      const eventName = yl.edition ? `${f.title} ${yl.edition}` : f.title;

      // Precise date from Wikipedia > generic YYYY-01-01
      const eventDate = yl.date ?? `${e.year}-01-01`;
      const eventDateEnd = yl.dateEnd ?? null;

      return {
        name: eventName,
        event_type: 'festival' as const,
        date: eventDate,
        date_end: eventDateEnd,
        city: yearLoc?.city ?? festLoc?.city ?? null,
        country: yearLoc?.country ?? festLoc?.country ?? null,
        poster_url: null, // Never propagate — run-festival-images.ts fetches per-year logos via DuckDuckGo
        source: 'wikipedia' as const,
        source_id: e.sourceId,
        source_url: wikiUrl,
        confidence_score: 0.7,
        is_past: e.year < new Date().getFullYear(),
        historic_badge_type: insightType,
        historic_badge_title: insightTitle,
        historic_badge_desc: insightDesc,
      };
    });

    // Insert individually to handle duplicates gracefully
    for (const item of batch) {
      // Try insert first
      const { data: single, error: insertErr } = await supabase
        .from('global_events').insert(item).select('id, source_id').single();

      if (single?.source_id) {
        eventMap.set(single.source_id, single.id);
        inserted++;
      } else if (insertErr) {
        // Duplicate — fetch existing ID
        const { data: existing } = await supabase
          .from('global_events').select('id')
          .eq('source_id', item.source_id).eq('source', 'wikipedia').single();
        if (existing) eventMap.set(item.source_id, existing.id);
      }
    }

    if ((i + 100) % 500 < 100 || i + 100 >= toInsert.length) {
      process.stdout.write(`\r  Inserted: ${inserted}/${toInsert.length}`);
    }
  }
  console.log(`\n  Events ready: ${eventMap.size}`);
  return eventMap;
}

// ─── Phase 3: Bulk Links ────────────────────────────────────

async function loadLinks(
  festivals: FestivalLineup[],
  artistMap: Map<string, string>,
  eventMap: Map<string, string>
): Promise<number> {
  console.log('\n═══ Phase 3: Artist ↔ Event Links ═══\n');

  // Build all link records
  const allLinks: Array<{
    global_event_id: string;
    artist_id: string;
    role: string;
    stage: string | null;
    billing_order: number;
  }> = [];

  let skippedNoEvent = 0;
  let skippedNoArtist = 0;

  for (const f of festivals) {
    for (const y of f.years) {
      // Must match the edition-aware sourceId from Phase 2
      const edSuffix = y.edition ? `:${y.edition.toLowerCase().replace(/\s+/g, '-')}` : '';
      const sourceId = `wiki:${f.pageId}:${y.year}${edSuffix}`;
      const eventId = eventMap.get(sourceId);
      if (!eventId) { skippedNoEvent += y.artists.length; continue; }

      // Dedup artists per event — same artist may appear on multiple stages/days
      const seenInEvent = new Set<string>();
      for (let j = 0; j < y.artists.length; j++) {
        const a = y.artists[j];
        const artistId = artistMap.get(normalize(a.name));
        if (!artistId) { skippedNoArtist++; continue; }

        const dedupKey = `${eventId}:${artistId}`;
        if (seenInEvent.has(dedupKey)) continue;
        seenInEvent.add(dedupKey);

        allLinks.push({
          global_event_id: eventId,
          artist_id: artistId,
          role: a.isHeadliner ? 'headliner' : 'performer',
          stage: a.stage ?? null,
          billing_order: j,
        });
      }
    }
  }

  console.log(`  Total links to create: ${allLinks.length}`);
  if (skippedNoEvent > 0) console.log(`  Skipped (no event): ${skippedNoEvent}`);
  if (skippedNoArtist > 0) console.log(`  Skipped (no artist): ${skippedNoArtist}`);

  // Insert in batches of 500
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < allLinks.length; i += 500) {
    const batch = allLinks.slice(i, i + 500);

    const { error } = await supabase.from('global_event_artists').insert(batch);

    if (error) {
      // Likely some duplicates — fall back to smaller batches
      for (let j = 0; j < batch.length; j += 50) {
        const smallBatch = batch.slice(j, j + 50);
        const { error: err2 } = await supabase.from('global_event_artists').insert(smallBatch);
        if (err2) {
          // Individual inserts for remaining conflicts
          for (const item of smallBatch) {
            const { error: err3 } = await supabase.from('global_event_artists').insert(item);
            if (err3) errors++;
            else inserted++;
          }
        } else {
          inserted += smallBatch.length;
        }
      }
    } else {
      inserted += batch.length;
    }

    if (inserted % 2000 === 0 || i + 500 >= allLinks.length) {
      process.stdout.write(`\r  Inserted: ${inserted}/${allLinks.length}${errors > 0 ? ` (${errors} errors)` : ''}`);
    }
  }
  console.log(`\n  Links created: ${inserted}`);
  return inserted;
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs();

  console.log('╔══════════════════════════════════════╗');
  console.log('║  Encore — Load Wikipedia Festivals   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Load data
  const dataPath = join(__dirname, 'data', 'festival-lineups.json');
  if (!existsSync(dataPath)) {
    console.error('festival-lineups.json not found. Run lineup parser first.');
    process.exit(1);
  }

  const festivals: FestivalLineup[] = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const toProcess = festivals.slice(0, limit);
  console.log(`Loaded ${festivals.length} festivals, processing ${toProcess.length}`);

  if (dryRun) {
    const totalArtists = toProcess.reduce((s, f) => s + f.years.reduce((ss, y) => ss + y.artists.length, 0), 0);
    const totalYears = toProcess.reduce((s, f) => s + f.years.length, 0);
    const uniqueArtists = new Set<string>();
    for (const f of toProcess) {
      for (const y of f.years) {
        for (const a of y.artists) uniqueArtists.add(normalize(a.name));
      }
    }
    const withEditions = toProcess.reduce((s, f) => s + f.years.filter(y => y.edition).length, 0);
    const withYearLoc = toProcess.reduce((s, f) => s + f.years.filter(y => y.location).length, 0);
    const withPreciseDate = toProcess.reduce((s, f) => s + f.years.filter(y => y.date && !y.date.endsWith('-01-01')).length, 0);
    const totalInsights = toProcess.reduce((s, f) => s + (f.insights?.length ?? 0), 0);
    const artistInsights = toProcess.reduce((s, f) => s + (f.insights?.filter(i => i.artistName)?.length ?? 0), 0);
    console.log('\nDRY RUN — would insert:');
    console.log(`  ${totalYears} global_events (festival-years)`);
    console.log(`  ~${uniqueArtists.size} unique artists`);
    console.log(`  ~${totalArtists} global_event_artists links`);
    console.log(`  ${toProcess.filter(f => f.posterUrl).length} with poster`);
    console.log(`  ${totalInsights} insights (${artistInsights} artist-specific)`);
    console.log(`  ${withEditions} year-editions (multi-city splits)`);
    console.log(`  ${withYearLoc} with per-year location`);
    console.log(`  ${withPreciseDate} with precise date`);
    return;
  }

  // Connect
  supabase = createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: testError } = await supabase.from('global_events').select('id').limit(1);
  if (testError) {
    console.error('Supabase connection failed:', testError.message);
    process.exit(1);
  }
  console.log('✓ Supabase connected');

  const t0 = Date.now();

  // Phase 1: Artists
  const artistMap = await loadArtists(toProcess);

  // Phase 2: Events
  const eventMap = await loadEvents(toProcess);

  // Phase 3: Links
  const linksCreated = await loadLinks(toProcess, artistMap, eventMap);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║         Load Complete                ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Festivals:   ${toProcess.length}`);
  console.log(`  Events:      ${eventMap.size}`);
  console.log(`  Artists:     ${artistMap.size}`);
  console.log(`  Links:       ${linksCreated}`);
  console.log(`  Time:        ${elapsed}s`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
