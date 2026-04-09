/**
 * Fetch edition-specific festival lineup posters via DuckDuckGo image search.
 *
 * Usage: npx tsx scripts/seed/run-poster-scraper.ts [--limit N] [--dry-run] [--all]
 *
 * Searches for "<event name> <city> <year> cartel lineup poster" to find the
 * specific lineup poster for that edition (not generic logos).
 *
 * --all: Re-scrape ALL events (including those with existing posters)
 *
 * Only updates events that currently have no poster_url (unless --all).
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
  // Step 1: Get vqd token
  const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  const html = await tokenRes.text();
  const vqdMatch = html.match(/vqd=["']([^"']+)["']/);
  if (!vqdMatch) return [];

  const vqd = vqdMatch[1];

  // Step 2: Fetch image results
  const params = new URLSearchParams({
    l: 'us-en',
    o: 'json',
    q: query,
    vqd,
    f: ',,,,,',
    p: '1',
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

// ─── Pick best lineup poster ─────────────────────────────────

function pickBestPoster(results: DDGImageResult[]): string | null {
  if (results.length === 0) return null;

  // Filter: reasonable size, prefer portrait/square (lineup posters are usually tall)
  const candidates = results.filter(r => {
    if (r.width < 300 || r.height < 300) return false;
    // Reject very wide banners (> 3:1 ratio)
    if (r.width / r.height > 3) return false;
    // Reject obvious bad sources
    const url = r.image.toLowerCase();
    if (url.includes('favicon') || url.includes('logo-small') || url.includes('icon')) return false;
    return true;
  });

  if (candidates.length === 0) return results[0]?.image ?? null;

  // Score candidates: lineup posters are typically portrait, large, and mention lineup/cartel in title
  const scored = candidates.map(r => {
    let score = 0;
    // Portrait orientation (lineup posters are tall)
    if (r.height > r.width) score += 3;
    // Square-ish is ok too
    if (Math.abs(r.height - r.width) / Math.max(r.height, r.width) < 0.2) score += 1;
    // Larger images score higher
    if (r.width >= 600 && r.height >= 600) score += 2;
    if (r.width >= 1000 || r.height >= 1000) score += 1;
    // Title mentions lineup/cartel/poster keywords
    const title = (r.title + ' ' + r.source).toLowerCase();
    if (title.includes('lineup') || title.includes('cartel') || title.includes('line-up')) score += 3;
    if (title.includes('poster') || title.includes('afiche') || title.includes('flyer')) score += 2;
    if (title.includes('festival')) score += 1;
    // Penalize generic/logo results
    if (title.includes('logo') || title.includes('icon') || title.includes('vector')) score -= 3;
    return { ...r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].image;
}

// ─── Build search query for specific edition ─────────────────

function buildQuery(name: string, city: string | null, country: string | null, year: number): string {
  // Build a specific query: "Lollapalooza Chile Santiago 2023 cartel lineup poster"
  const parts = [name];
  if (city) parts.push(city);
  if (country && country !== city) parts.push(country);
  parts.push(String(year));
  parts.push('cartel lineup poster');
  return parts.join(' ');
}

// ─── Verify image URL is reachable ──────────────────────────

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
      return idx !== -1 ? parseInt(args[idx + 1], 10) : 100;
    })(),
    dryRun: args.includes('--dry-run'),
    all: args.includes('--all'),
  };
}

async function main() {
  const { limit, dryRun, all } = parseArgs();

  console.log(`Fetching events ${all ? '(ALL)' : 'without posters'} (limit: ${limit})...`);

  // Paginate to get all events (Supabase max 1000 per query)
  const events: Array<{ id: string; name: string; date: string | null; city: string | null; country: string | null }> = [];
  let page = 0;
  const pageSize = 1000;
  while (events.length < limit) {
    let q = supabase
      .from('global_events')
      .select('id, name, date, city, country')
      .order('date', { ascending: false })
      .range(page * pageSize, Math.min((page + 1) * pageSize - 1, limit - 1));

    if (!all) {
      q = q.is('poster_url', null);
    }

    const { data, error: pageErr } = await q;
    if (pageErr) { console.error('DB error:', pageErr.message); process.exit(1); }
    if (!data || data.length === 0) break;
    events.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  events.splice(limit); // trim to exact limit

  console.log(`Found ${events.length} events to process\n`);

  let found = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const year = event.date ? new Date(event.date).getFullYear() : 0;
    if (!year) {
      notFound++;
      continue;
    }

    const searchQuery = buildQuery(event.name, event.city, event.country, year);
    process.stdout.write(`  ${i + 1}/${events.length} | ${event.name} (${event.city ?? '?'} ${year})...`);

    try {
      const results = await searchDDGImages(searchQuery);
      const posterUrl = pickBestPoster(results);

      if (posterUrl) {
        const valid = await verifyImageUrl(posterUrl);
        if (valid) {
          if (!dryRun) {
            await supabase
              .from('global_events')
              .update({ poster_url: posterUrl })
              .eq('id', event.id);
          }
          found++;
          console.log(` ✓ ${dryRun ? '[DRY] ' : ''}found`);
        } else {
          notFound++;
          console.log(' ✗ image unreachable');
        }
      } else {
        notFound++;
        console.log(' ✗ no results');
      }
    } catch (err) {
      errors++;
      console.log(` ✗ error: ${err instanceof Error ? err.message : err}`);
    }

    // Rate limit: 2s between searches to not get blocked
    await new Promise(r => setTimeout(r, 2000));

    // Progress summary every 25
    if ((i + 1) % 25 === 0) {
      console.log(`\n  --- Progress: ${i + 1}/${events.length} | Found: ${found} | Not found: ${notFound} | Errors: ${errors} ---\n`);
    }
  }

  console.log('\n=== Poster Scraping Complete ===');
  console.log(`Processed: ${events.length}`);
  console.log(`Found: ${found}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);
  if (dryRun) console.log('(DRY RUN — no changes saved)');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
