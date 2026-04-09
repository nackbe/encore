/**
 * Scrape lineup/cartel poster images for festivals via DuckDuckGo.
 *
 * Usage: npx tsx scripts/seed/run-lineup-poster-scraper.ts [--limit N] [--dry-run]
 *
 * STRICT validation:
 * - Only searches festivals (not concerts)
 * - Query: "<festival> <city> <year> cartel lineup poster"
 * - Result MUST mention festival name in title/source
 * - Result MUST be portrait or square (lineup posters are tall)
 * - Minimum 500x500 resolution
 * - Title must contain lineup/cartel/line-up keyword
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '..', '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── DuckDuckGo image search ────────────────────────────────

interface DDGImageResult {
  image: string;
  thumbnail: string;
  title: string;
  width: number;
  height: number;
  source: string;
}

async function searchDDGImages(query: string): Promise<DDGImageResult[]> {
  const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  const html = await tokenRes.text();
  const vqdMatch = html.match(/vqd=["']([^"']+)["']/);
  if (!vqdMatch) return [];

  const params = new URLSearchParams({
    l: 'us-en', o: 'json', q: query, vqd: vqdMatch[1], f: ',,,,,', p: '1',
  });

  const imgRes = await fetch(`https://duckduckgo.com/i.js?${params}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://duckduckgo.com/',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!imgRes.ok) return [];
  const data = await imgRes.json() as { results?: DDGImageResult[] };
  return data.results ?? [];
}

// ─── Strict lineup poster selection ─────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findLineupPoster(
  results: DDGImageResult[],
  festivalName: string,
  year: number
): string | null {
  const normName = normalize(festivalName);
  // Extract key words from festival name (at least 2 chars, skip common words)
  const skipWords = new Set(['the', 'festival', 'fest', 'de', 'del', 'los', 'las', 'and', 'at', 'in', 'en']);
  const nameWords = normName.split(/\s+/).filter(w => w.length >= 3 && !skipWords.has(w));

  const yearStr = String(year);

  for (const r of results) {
    const text = normalize(r.title + ' ' + r.source);

    // MUST: title/source mentions the festival name (at least 2 key words match)
    const matchedWords = nameWords.filter(w => text.includes(w));
    if (matchedWords.length < Math.min(2, nameWords.length)) continue;

    // MUST: mentions lineup/cartel/line-up keyword
    const hasLineupKeyword = /lineup|line-up|cartel|afiche|flyer|artistas|artists/.test(text);
    if (!hasLineupKeyword) continue;

    // MUST: mentions the year
    if (!text.includes(yearStr)) continue;

    // MUST: reasonable resolution
    if (r.width < 500 || r.height < 500) continue;

    // MUST: portrait or square (lineup posters are always tall, not wide banners)
    const ratio = r.width / r.height;
    if (ratio > 1.3) continue; // reject landscape

    // MUST: not a logo, icon, or tiny asset
    const url = r.image.toLowerCase();
    if (url.includes('favicon') || url.includes('logo') || url.includes('icon') || url.includes('avatar')) continue;

    return r.image;
  }

  return null;
}

// ─── Verify image URL ───────────────────────────────────────

async function verifyImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const ct = res.headers.get('content-type') ?? '';
    return res.ok && ct.startsWith('image/');
  } catch {
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    limit: (() => {
      const idx = args.indexOf('--limit');
      return idx !== -1 ? parseInt(args[idx + 1], 10) : 500;
    })(),
    dryRun: args.includes('--dry-run'),
  };
}

async function main() {
  const { limit, dryRun } = parseArgs();

  console.log(`Fetching festivals without lineup images (limit: ${limit})...`);

  // Paginate
  const events: Array<{ id: string; name: string; date: string; city: string | null; country: string | null }> = [];
  let page = 0;
  const pageSize = 1000;
  while (events.length < limit) {
    const { data, error } = await supabase
      .from('global_events')
      .select('id, name, date, city, country')
      .eq('event_type', 'festival')
      .is('lineup_image_url', null)
      .order('date', { ascending: false })
      .range(page * pageSize, Math.min((page + 1) * pageSize - 1, limit - 1));

    if (error) { console.error('DB error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    events.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  events.splice(limit);

  console.log(`Found ${events.length} festivals to process\n`);

  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const year = event.date ? new Date(event.date).getFullYear() : 0;
    if (!year) { notFound++; continue; }

    // Build specific query
    const parts = [event.name];
    if (event.city) parts.push(event.city);
    parts.push(String(year), 'cartel lineup poster');
    const query = parts.join(' ');

    process.stdout.write(`  ${i + 1}/${events.length} | ${event.name} (${event.city ?? '?'} ${year})...`);

    try {
      const results = await searchDDGImages(query);
      const lineupUrl = findLineupPoster(results, event.name, year);

      if (lineupUrl) {
        const valid = await verifyImageUrl(lineupUrl);
        if (valid) {
          if (!dryRun) {
            await supabase
              .from('global_events')
              .update({ lineup_image_url: lineupUrl })
              .eq('id', event.id);
          }
          found++;
          console.log(` ✓ ${dryRun ? '[DRY] ' : ''}found`);
        } else {
          notFound++;
          console.log(' ✗ unreachable');
        }
      } else {
        notFound++;
        console.log(' ✗ no match');
      }
    } catch (err) {
      errors++;
      console.log(` ✗ error: ${err instanceof Error ? err.message : err}`);
    }

    // Rate limit: 2.5s between searches
    await new Promise(r => setTimeout(r, 2500));

    if ((i + 1) % 25 === 0) {
      console.log(`\n  --- ${i + 1}/${events.length} | Found: ${found} | Miss: ${notFound} | Err: ${errors} ---\n`);
    }
  }

  console.log('\n=== Lineup Poster Scraping Complete ===');
  console.log(`Processed: ${events.length}`);
  console.log(`Found: ${found} (${((found / events.length) * 100).toFixed(1)}%)`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);
  if (dryRun) console.log('(DRY RUN — no changes saved)');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
