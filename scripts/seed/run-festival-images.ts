/**
 * Scrape TWO types of images for festivals via DuckDuckGo:
 *   1. poster_url    — Festival logo/brand image (shown in collection grid + detail hero)
 *                      Query: "<festival> festival logo <year>"
 *   2. lineup_image_url — Lineup/cartel poster (shown only in detail view)
 *                      Query: "<festival> festival lineup <year>"
 *
 * Usage: npx tsx scripts/seed/run-festival-images.ts [--limit N] [--dry-run] [--type logo|lineup|both]
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
  try {
    const tokenRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      }
    );
    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=["']([^"']+)["']/);
    if (!vqdMatch) return [];

    const params = new URLSearchParams({
      l: 'us-en', o: 'json', q: query, vqd: vqdMatch[1], f: ',,,,,', p: '1',
    });

    const imgRes = await fetch(`https://duckduckgo.com/i.js?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://duckduckgo.com/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!imgRes.ok) return [];
    const data = (await imgRes.json()) as { results?: DDGImageResult[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ─── Helpers ────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

const SKIP_WORDS = new Set(['the', 'festival', 'fest', 'de', 'del', 'los', 'las', 'and', 'at', 'in', 'en']);

function nameWords(festivalName: string): string[] {
  return normalize(festivalName).split(/\s+/).filter((w) => w.length >= 3 && !SKIP_WORDS.has(w));
}

function nameMatches(text: string, words: string[], minMatch: number): boolean {
  const normText = normalize(text);
  const matched = words.filter((w) => normText.includes(w));
  return matched.length >= minMatch;
}

// ─── Logo image selection ───────────────────────────────────

function findLogoImage(results: DDGImageResult[], festivalName: string, year: number): string | null {
  const words = nameWords(festivalName);
  const minMatch = Math.min(2, words.length);
  const yearStr = String(year);

  for (const r of results) {
    const text = r.title + ' ' + r.source;

    // Must mention festival name
    if (!nameMatches(text, words, minMatch)) continue;

    // Must be reasonable resolution
    if (r.width < 400 || r.height < 300) continue;

    // Reject tiny icons/favicons
    const url = r.image.toLowerCase();
    if (url.includes('favicon') || url.includes('icon') || url.includes('avatar')) continue;

    // Prefer landscape or square (logos, brand images, stage photos)
    // Accept anything that's not extremely tall/narrow
    const ratio = r.width / r.height;
    if (ratio < 0.5) continue; // reject very tall/narrow

    return r.image;
  }
  return null;
}

// ─── Lineup image selection ─────────────────────────────────

function findLineupImage(results: DDGImageResult[], festivalName: string, year: number): string | null {
  const words = nameWords(festivalName);
  const minMatch = Math.min(2, words.length);
  const yearStr = String(year);

  for (const r of results) {
    const text = normalize(r.title + ' ' + r.source);

    // Must mention festival name
    if (!nameMatches(r.title + ' ' + r.source, words, minMatch)) continue;

    // Must mention lineup/cartel keyword
    if (!/lineup|line-up|cartel|afiche|artistas|artists|line up/.test(text)) continue;

    // Must be reasonable resolution
    if (r.width < 500 || r.height < 500) continue;

    // Reject icons
    const url = r.image.toLowerCase();
    if (url.includes('favicon') || url.includes('logo') || url.includes('icon') || url.includes('avatar')) continue;

    // Lineup posters: portrait or square preferred, but accept landscape too (some cartels are wide)
    // Just reject extreme landscapes
    const ratio = r.width / r.height;
    if (ratio > 2.0) continue;

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
    type: (() => {
      const idx = args.indexOf('--type');
      return idx !== -1 ? (args[idx + 1] as 'logo' | 'lineup' | 'both') : 'both';
    })(),
  };
}

async function main() {
  const { limit, dryRun, type } = parseArgs();
  const doLogo = type === 'logo' || type === 'both';
  const doLineup = type === 'lineup' || type === 'both';

  console.log(`Festival image scraper (type: ${type}, limit: ${limit}, dry: ${dryRun})\n`);

  // Fetch festivals — prioritize those missing images
  const events: Array<{ id: string; name: string; date: string; city: string | null; poster_url: string | null; lineup_image_url: string | null }> = [];
  let page = 0;
  const pageSize = 1000;

  while (events.length < limit) {
    let query = supabase
      .from('global_events')
      .select('id, name, date, city, poster_url, lineup_image_url')
      .eq('event_type', 'festival')
      .order('date', { ascending: false })
      .range(page * pageSize, Math.min((page + 1) * pageSize - 1, limit - 1));

    // Filter: need at least one image type missing
    if (type === 'logo') {
      query = query.is('poster_url', null);
    } else if (type === 'lineup') {
      query = query.is('lineup_image_url', null);
    } else {
      // both: get festivals missing either
      query = query.or('poster_url.is.null,lineup_image_url.is.null');
    }

    const { data, error } = await query;
    if (error) { console.error('DB error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    events.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  events.splice(limit);

  console.log(`Found ${events.length} festivals to process\n`);

  let logoFound = 0, lineupFound = 0, errors = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const year = event.date ? new Date(event.date).getFullYear() : 0;
    if (!year) continue;

    const nameClean = event.name.replace(/past editions?/i, '').trim();
    process.stdout.write(`  ${i + 1}/${events.length} | ${nameClean} (${year})...`);

    try {
      const update: Record<string, string | null> = {};

      // 1. Logo/poster image
      if (doLogo && !event.poster_url) {
        const logoQuery = `${nameClean} festival logo ${year}`;
        const logoResults = await searchDDGImages(logoQuery);
        const logoUrl = findLogoImage(logoResults, nameClean, year);

        if (logoUrl && await verifyImageUrl(logoUrl)) {
          update.poster_url = logoUrl;
          logoFound++;
          process.stdout.write(' logo:✓');
        } else {
          process.stdout.write(' logo:✗');
        }

        // Rate limit between searches
        await new Promise((r) => setTimeout(r, 2000));
      }

      // 2. Lineup image
      if (doLineup && !event.lineup_image_url) {
        const lineupQuery = `${nameClean} festival lineup ${year}`;
        const lineupResults = await searchDDGImages(lineupQuery);
        const lineupUrl = findLineupImage(lineupResults, nameClean, year);

        if (lineupUrl && await verifyImageUrl(lineupUrl)) {
          update.lineup_image_url = lineupUrl;
          lineupFound++;
          process.stdout.write(' lineup:✓');
        } else {
          process.stdout.write(' lineup:✗');
        }

        await new Promise((r) => setTimeout(r, 2000));
      }

      // Save
      if (Object.keys(update).length > 0 && !dryRun) {
        await supabase.from('global_events').update(update).eq('id', event.id);
      }

      console.log(dryRun ? ' [DRY]' : '');
    } catch (err) {
      errors++;
      console.log(` error: ${err instanceof Error ? err.message : err}`);
    }

    if ((i + 1) % 25 === 0) {
      console.log(`\n  --- ${i + 1}/${events.length} | Logos: ${logoFound} | Lineups: ${lineupFound} | Err: ${errors} ---\n`);
    }
  }

  console.log('\n=== Festival Image Scraping Complete ===');
  console.log(`Processed: ${events.length}`);
  console.log(`Logos found: ${logoFound}`);
  console.log(`Lineups found: ${lineupFound}`);
  console.log(`Errors: ${errors}`);
  if (dryRun) console.log('(DRY RUN — no changes saved)');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
