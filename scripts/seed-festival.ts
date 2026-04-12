/**
 * Seed a single festival by Wikipedia title directly into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-festival.ts "Dcode Festival" es
 *   npx tsx scripts/seed-festival.ts "Rock al Parque" es
 *   npx tsx scripts/seed-festival.ts "Glastonbury Festival" en
 *   npx tsx scripts/seed-festival.ts "Dcode Festival" es --dry-run
 *
 * Arguments:
 *   1. Wikipedia article title (required)
 *   2. Language code: en | es | pt (default: es)
 *   --dry-run   Parse and show results without writing to DB
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '..', '.env.local') });

// City → coordinates lookup (subset of run-geocode CITY_COORDS)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'madrid': { lat: 40.417, lng: -3.704 }, 'barcelona': { lat: 41.386, lng: 2.170 },
  'london': { lat: 51.507, lng: -0.128 }, 'paris': { lat: 48.857, lng: 2.352 },
  'berlin': { lat: 52.520, lng: 13.405 }, 'amsterdam': { lat: 52.370, lng: 4.895 },
  'lisbon': { lat: 38.722, lng: -9.139 }, 'rome': { lat: 41.902, lng: 12.496 },
  'milan': { lat: 45.464, lng: 9.190 }, 'vienna': { lat: 48.208, lng: 16.374 },
  'brussels': { lat: 50.850, lng: 4.352 }, 'dublin': { lat: 53.350, lng: -6.260 },
  'stockholm': { lat: 59.329, lng: 18.069 }, 'oslo': { lat: 59.914, lng: 10.752 },
  'copenhagen': { lat: 55.676, lng: 12.569 }, 'helsinki': { lat: 60.170, lng: 24.938 },
  'bogotá': { lat: 4.711, lng: -74.072 }, 'bogota': { lat: 4.711, lng: -74.072 },
  'medellín': { lat: 6.217, lng: -75.568 }, 'medellin': { lat: 6.217, lng: -75.568 },
  'buenos aires': { lat: -34.604, lng: -58.382 },
  'santiago': { lat: -33.449, lng: -70.669 },
  'são paulo': { lat: -23.551, lng: -46.634 }, 'sao paulo': { lat: -23.551, lng: -46.634 },
  'rio de janeiro': { lat: -22.907, lng: -43.173 },
  'mexico city': { lat: 19.433, lng: -99.133 },
  'lima': { lat: -12.046, lng: -77.043 },
  'new york': { lat: 40.713, lng: -74.006 }, 'los angeles': { lat: 34.052, lng: -118.244 },
  'chicago': { lat: 41.878, lng: -87.630 }, 'austin': { lat: 30.267, lng: -97.743 },
  'tokyo': { lat: 35.689, lng: 139.692 }, 'seoul': { lat: 37.566, lng: 126.978 },
  'sydney': { lat: -33.868, lng: 151.209 }, 'melbourne': { lat: -37.814, lng: 144.963 },
};

function geocodeCity(city: string | null | undefined): { lat: number; lng: number } | null {
  if (!city) return null;
  return CITY_COORDS[city.toLowerCase()] ?? null;
}

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/types';
import { parseFestivalLineup } from './seed/crawlers/wikipedia-lineup-parser';
import type { FestivalLineup } from './seed/crawlers/wikipedia-lineup-parser';

const title = process.argv[2];
const lang = (process.argv[3] as 'en' | 'es' | 'pt') ?? 'es';
const dryRun = process.argv.includes('--dry-run');

if (!title) {
  console.error('Usage: npx tsx scripts/seed-festival.ts "Festival Name" [lang] [--dry-run]');
  process.exit(1);
}

function normalize(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

async function main() {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  Encore — Seed Single Festival           ║`);
  console.log(`╚══════════════════════════════════════════╝`);
  console.log(`Festival : "${title}" (${lang})`);
  console.log(`Mode     : ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // ── Step 1: Parse Wikipedia ──────────────────────────────────
  console.log('Step 1/3: Parsing Wikipedia...');
  const lineup = await parseFestivalLineup(title, lang, 0);

  if (!lineup) {
    console.error(`✗ Could not parse "${title}" from ${lang}.wikipedia.org`);
    console.error('  Check that the title is exactly as it appears on Wikipedia.');
    process.exit(1);
  }

  const totalArtists = lineup.years.reduce((s, y) => s + y.artists.length, 0);
  console.log(`✓ Found ${lineup.years.length} years, ${totalArtists} artist entries`);

  for (const y of lineup.years) {
    const editions = [...new Set(y.artists.map(a => a.edition).filter(Boolean))];
    const edLabel = editions.length ? ` [${editions.join(', ')}]` : '';
    console.log(`  ${y.year}${edLabel}: ${y.artists.length} artists`);
    y.artists.slice(0, 5).forEach(a => console.log(`    - ${a.name}${a.isHeadliner ? ' ★' : ''}`));
    if (y.artists.length > 5) console.log(`    ... +${y.artists.length - 5} more`);
  }

  if (lineup.location) {
    console.log(`  Location: ${lineup.location.city ?? '?'}, ${lineup.location.country ?? '?'}`);
  }

  if (totalArtists === 0) {
    console.warn('\n⚠ No artists found. The Wikipedia page may use an unsupported format.');
    console.warn('  You can still use --dry-run to inspect, but the DB would have empty lineups.');
    if (!dryRun) process.exit(1);
  }

  if (dryRun) {
    console.log('\nDRY RUN complete — no DB writes.');
    return;
  }

  // ── Step 2-4: Load into Supabase ─────────────────────────────
  const supabase = createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );

  const festivals: FestivalLineup[] = [lineup];

  // Phase 1: Artists
  console.log('\nStep 2/3: Upserting artists...');
  const artistMap = new Map<string, string>(); // normalized → uuid
  const uniqueArtists = new Map<string, string>(); // normalized → original

  for (const y of lineup.years) {
    for (const a of y.artists) {
      const key = normalize(a.name);
      if (!uniqueArtists.has(key)) uniqueArtists.set(key, a.name);
    }
  }

  const allKeys = [...uniqueArtists.keys()];
  // Fetch existing
  for (let i = 0; i < allKeys.length; i += 500) {
    const batch = allKeys.slice(i, i + 500);
    const { data } = await supabase.from('artists').select('id, name_normalized').in('name_normalized', batch);
    if (data) data.forEach(a => artistMap.set(a.name_normalized, a.id));
  }

  // Insert missing
  const toInsert = allKeys.filter(k => !artistMap.has(k));
  let insertedArtists = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200).map(key => ({
      name: uniqueArtists.get(key)!,
      name_normalized: key,
      genres: [] as string[],
    }));
    const { data, error } = await supabase.from('artists').insert(batch).select('id, name_normalized');
    if (data) {
      data.forEach(a => artistMap.set(a.name_normalized, a.id));
      insertedArtists += data.length;
    } else if (error) {
      // Individual fallback
      for (const item of batch) {
        const { data: d } = await supabase.from('artists').upsert(item, { onConflict: 'name_normalized' }).select('id, name_normalized').single();
        if (d) { artistMap.set(d.name_normalized, d.id); insertedArtists++; }
      }
    }
  }
  console.log(`✓ Artists: ${artistMap.size} total (${insertedArtists} new)`);

  // Phase 2: Events
  console.log('\nStep 3/3: Upserting events and links...');
  const eventMap = new Map<string, string>(); // sourceId → uuid
  let insertedEvents = 0;
  let insertedLinks = 0;

  for (const y of lineup.years) {
    const edSuffix = y.edition ? `:${y.edition.toLowerCase().replace(/\s+/g, '-')}` : '';
    const sourceId = `wiki:${lineup.pageId}:${y.year}${edSuffix}`;

    const eventName = y.edition ? `${lineup.title} ${y.edition}` : lineup.title;
    const festLoc = lineup.location;
    const yearLoc = y.location;
    const city = yearLoc?.city ?? festLoc?.city ?? null;
    const coords = geocodeCity(city);

    // Build event payload
    const eventPayload = {
      name: eventName,
      event_type: 'festival' as const,
      date: y.date ?? `${y.year}-01-01`,
      date_end: y.dateEnd ?? null,
      city,
      country: yearLoc?.country ?? festLoc?.country ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      poster_url: lineup.posterUrl ?? null,
      source: 'wikipedia' as const,
      source_id: sourceId,
      source_url: `https://${lineup.lang}.wikipedia.org/wiki/${encodeURIComponent(lineup.sourcePage.replace(/ /g, '_'))}`,
      confidence_score: 0.7,
      is_past: y.year < new Date().getFullYear(),
    };

    // Check if exists
    const { data: existing } = await supabase
      .from('global_events').select('id')
      .eq('source_id', sourceId).eq('source', 'wikipedia').single();

    let eventId: string;
    if (existing) {
      eventId = existing.id;
      // Update city/country if now available and previously null
      await supabase.from('global_events').update(eventPayload).eq('id', eventId);
    } else {
      const { data: inserted } = await supabase.from('global_events').insert(eventPayload).select('id').single();
      if (!inserted) { console.warn(`  ✗ Failed to insert event for ${y.year}`); continue; }
      eventId = inserted.id;
      insertedEvents++;
    }
    eventMap.set(sourceId, eventId);

    // Phase 3: Links for this year
    const seen = new Set<string>();
    const links = [];
    for (let j = 0; j < y.artists.length; j++) {
      const a = y.artists[j];
      const artistId = artistMap.get(normalize(a.name));
      if (!artistId) continue;
      const dedupKey = `${eventId}:${artistId}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      links.push({ global_event_id: eventId, artist_id: artistId, role: a.isHeadliner ? 'headliner' : 'performer', stage: a.stage ?? null, billing_order: j });
    }

    if (links.length > 0) {
      // Delete existing links first (to handle re-seed cleanly)
      await supabase.from('global_event_artists').delete().eq('global_event_id', eventId);
      const { error } = await supabase.from('global_event_artists').insert(links);
      if (!error) insertedLinks += links.length;
      else {
        // Fallback: insert individually
        for (const link of links) {
          const { error: e } = await supabase.from('global_event_artists').insert(link);
          if (!e) insertedLinks++;
        }
      }
    }
  }

  console.log(`✓ Events: ${eventMap.size} total (${insertedEvents} new)`);
  console.log(`✓ Artist links: ${insertedLinks}`);
  console.log(`\n✅ Done! "${lineup.title}" is now searchable in Encore.`);
}

main().catch((e) => {
  console.error('\n✗ Error:', e);
  process.exit(1);
});
