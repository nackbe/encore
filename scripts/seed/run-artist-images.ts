/**
 * Batch-enrich artists: images from fanart.tv (primary) + Spotify (fallback) + genres from MusicBrainz.
 *
 * Usage: npx tsx scripts/seed/run-artist-images.ts [--limit N] [--dry-run] [--genres-only]
 *
 * --genres-only: Skip image fetch, only fetch MusicBrainz genres for artists missing them
 *
 * Image cascade: fanart.tv (by MBID) → Spotify search (fallback)
 * Processes sequentially with MusicBrainz 1req/s rate limit.
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

// ─── fanart.tv (primary image source) ─────────────────────────

const FANART_API_KEY = process.env.FANART_API_KEY ?? '';

async function searchFanart(mbid: string): Promise<string | null> {
  if (!FANART_API_KEY || !mbid) return null;
  try {
    const res = await fetch(
      `https://webservice.fanart.tv/v3/music/${mbid}?api_key=${FANART_API_KEY}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      artistthumb?: Array<{ url: string; likes: string }>;
      hdmusiclogo?: Array<{ url: string; likes: string }>;
      artistbackground?: Array<{ url: string; likes: string }>;
    };
    // Prefer artistthumb (clean portrait), then background
    const thumbs = data.artistthumb ?? [];
    if (thumbs.length > 0) {
      const sorted = [...thumbs].sort((a, b) => Number(b.likes) - Number(a.likes));
      return sorted[0].url;
    }
    const bgs = data.artistbackground ?? [];
    if (bgs.length > 0) {
      const sorted = [...bgs].sort((a, b) => Number(b.likes) - Number(a.likes));
      return sorted[0].url;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Spotify (fallback image source) ─────────────────────────

let spotifyToken: string | null = null;
let tokenExpiry = 0;
let spotifyDisabled = false;

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json() as { access_token: string; expires_in: number };
  spotifyToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early
  return spotifyToken;
}

interface SpotifyArtist {
  name: string;
  images: Array<{ url: string; width: number; height: number }>;
}

async function searchSpotify(name: string): Promise<string | null> {
  const token = await getSpotifyToken();
  const params = new URLSearchParams({ q: name, type: 'artist', limit: '1' });

  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 429) {
    const raw = parseInt(res.headers.get('retry-after') ?? '5', 10);
    if (raw > 60) {
      console.log(`\n  Spotify rate limited (${raw}s) — disabling Spotify for this run`);
      spotifyDisabled = true;
      return null;
    }
    const retryAfter = Math.min(raw, 30);
    console.log(`\n  Rate limited (retry-after: ${raw}s), waiting ${retryAfter}s...`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return searchSpotify(name); // retry
  }

  if (!res.ok) return null;

  const data = await res.json() as { artists: { items: SpotifyArtist[] } };
  const artist = data.artists?.items?.[0];
  if (!artist?.images?.length) return null;

  // Verify name match (case-insensitive, allow partial)
  const spotName = artist.name.toLowerCase().trim();
  const queryName = name.toLowerCase().trim();
  if (spotName !== queryName && !spotName.includes(queryName) && !queryName.includes(spotName)) {
    return null;
  }

  // Pick medium-size image (300-640px) for fast loading
  const imgs = artist.images;
  const medium = imgs.find(img => img.width >= 300 && img.width <= 640);
  return medium?.url ?? imgs[imgs.length > 1 ? 1 : 0].url;
}

// ─── MusicBrainz (genres) ─────────────────────────────────────

const MB_API = 'https://musicbrainz.org/ws/2';
const MB_UA = 'Encore/1.0.0 (https://github.com/nackbe/encore)';
let lastMBCall = 0;

async function mbRateLimit() {
  // MusicBrainz: max 1 req/sec
  const elapsed = Date.now() - lastMBCall;
  if (elapsed < 1100) await new Promise(r => setTimeout(r, 1100 - elapsed));
  lastMBCall = Date.now();
}

/** Search MusicBrainz for an artist by name, return MBID if good match */
async function searchMBArtist(name: string): Promise<string | null> {
  await mbRateLimit();
  try {
    const params = new URLSearchParams({ query: `artist:"${name}"`, fmt: 'json', limit: '1' });
    const res = await fetch(`${MB_API}/artist/?${params}`, {
      headers: { 'User-Agent': MB_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { artists?: Array<{ id: string; name: string; score: number }> };
    const best = data.artists?.[0];
    if (!best || best.score < 90) return null;
    // Verify name match
    if (best.name.toLowerCase() !== name.toLowerCase()) return null;
    return best.id;
  } catch {
    return null;
  }
}

/** Fetch genres (tags) for an artist by MBID */
async function fetchMBGenres(mbid: string): Promise<string[]> {
  await mbRateLimit();
  try {
    const res = await fetch(`${MB_API}/artist/${mbid}?inc=tags&fmt=json`, {
      headers: { 'User-Agent': MB_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { tags?: Array<{ name: string; count: number }> };
    if (!data.tags?.length) return [];
    return data.tags
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(t => t.name);
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    genresOnly: args.includes('--genres-only'),
    limit: (() => {
      const idx = args.indexOf('--limit');
      return idx !== -1 ? parseInt(args[idx + 1], 10) : Infinity;
    })(),
  };
}

async function main() {
  const { dryRun, genresOnly, limit } = parseArgs();

  console.log('╔══════════════════════════════════════╗');
  console.log('║  Encore — Batch Artist Enrichment    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'} | ${genresOnly ? 'GENRES ONLY' : 'IMAGES + GENRES'} | Limit: ${limit === Infinity ? 'ALL' : limit}`);

  // Fetch artists needing enrichment
  let artists: Array<{ id: string; name: string; musicbrainz_id: string | null; image_url: string | null; genres: string[] | null }> = [];
  let from = 0;
  console.log(`\nFetching artists needing ${genresOnly ? 'genres' : 'images/genres'}...`);

  while (artists.length < limit) {
    const batchSize = Math.min(1000, limit - artists.length);
    let q = supabase
      .from('artists')
      .select('id, name, musicbrainz_id, image_url, genres');

    if (genresOnly) {
      // Only artists with empty/null genres
      q = q.or('genres.is.null,genres.eq.{}');
    } else {
      // Artists without images (genres fetched as bonus)
      q = q.is('image_url', null);
    }

    const { data } = await q.range(from, from + batchSize - 1);
    if (!data || data.length === 0) break;
    artists.push(...data);
    from += data.length;
    if (data.length < batchSize) break;
  }

  console.log(`Artists to process: ${artists.length}`);
  if (dryRun) { console.log('DRY RUN — exiting'); return; }

  if (!genresOnly) {
    console.log(`fanart.tv: ${FANART_API_KEY ? '✓ key found' : '✗ no key (skipping)'}`);
    try {
      await getSpotifyToken();
      console.log('Spotify: ✓ connected (fallback)');
    } catch (e) {
      console.log('Spotify: ✗ auth failed (fanart.tv only)', (e as Error).message);
      spotifyDisabled = true;
    }
  }

  const t0 = Date.now();
  let imagesFound = 0;
  let genresFound = 0;
  let noResult = 0;
  let errors = 0;

  // MusicBrainz is 1 req/s, so we process sequentially for genres
  // Spotify is faster but we batch conservatively
  const BATCH = genresOnly ? 1 : 3;
  const DELAY = genresOnly ? 0 : 1500; // MB has its own rate limiter
  const PAUSE_EVERY = 500;
  const PAUSE_DURATION = genresOnly ? 10000 : 60000;

  for (let i = 0; i < artists.length; i += BATCH) {
    const batch = artists.slice(i, i + BATCH);

    await Promise.allSettled(
      batch.map(async (artist) => {
        try {
          const update: Record<string, unknown> = {};

          // ── Genres (MusicBrainz) — do first to get MBID for fanart.tv ──
          let mbid = artist.musicbrainz_id;
          const needsGenres = !artist.genres || artist.genres.length === 0;

          if (!mbid) {
            mbid = await searchMBArtist(artist.name);
            if (mbid) update.musicbrainz_id = mbid;
          }

          if (needsGenres && mbid) {
            const genres = await fetchMBGenres(mbid);
            if (genres.length > 0) {
              update.genres = genres;
              genresFound++;
            }
          }

          // ── Image: fanart.tv (primary) → Spotify (fallback) ──
          if (!genresOnly && !artist.image_url) {
            let imageUrl: string | null = null;

            // Try fanart.tv first (needs MBID)
            if (mbid) {
              imageUrl = await searchFanart(mbid);
            }

            // Fallback to Spotify if fanart.tv didn't have it
            if (!imageUrl && !spotifyDisabled) {
              imageUrl = await searchSpotify(artist.name);
            }

            if (imageUrl) {
              update.image_url = imageUrl;
              imagesFound++;
            }
          }

          if (Object.keys(update).length > 0) {
            await supabase.from('artists').update(update).eq('id', artist.id);
          } else {
            noResult++;
          }
        } catch {
          errors++;
        }
      })
    );

    // Progress
    if ((i + BATCH) % 50 === 0 || i + BATCH >= artists.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      process.stdout.write(
        `\r  ${Math.min(i + BATCH, artists.length)}/${artists.length} | Images: ${imagesFound} | Genres: ${genresFound} | None: ${noResult} | Err: ${errors} | ${elapsed}s`
      );
    }

    if (DELAY && i + BATCH < artists.length) {
      await new Promise(r => setTimeout(r, DELAY));
    }

    if ((i + BATCH) % PAUSE_EVERY === 0 && i + BATCH < artists.length) {
      console.log(`\n  Pausing ${PAUSE_DURATION / 1000}s...`);
      await new Promise(r => setTimeout(r, PAUSE_DURATION));
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n');
  console.log('╔══════════════════════════════════════╗');
  console.log('║       Artist Enrichment Complete     ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Processed:    ${artists.length}`);
  console.log(`  Images found: ${imagesFound}`);
  console.log(`  Genres found: ${genresFound}`);
  console.log(`  No result:    ${noResult}`);
  console.log(`  Errors:       ${errors}`);
  console.log(`  Time:         ${elapsed}s`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
