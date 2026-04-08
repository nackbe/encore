/**
 * Artist Image Cascade — single function used by:
 *   1. RegisterFlow Step 2 (on-demand, per-artist)
 *   2. Festival seed batch (scripts/seed/)
 *
 * Cascade order (precision first):
 *   1. DB cache (artists.image_url) → instant, $0
 *   2. fanart.tv (by MBID) → HD curated community images, most precise
 *   3. Spotify search → artist profile image, usually good quality
 *   4. Ticketmaster attractions → HD but name-only search, can mismatch
 *   5. null → UI renders placeholder SVG
 *
 * On first find: saves URL to artists table for next caller.
 */

import { getArtistThumb } from './fanart';

const TM_API_BASE = 'https://app.ticketmaster.com/discovery/v2';

// ─── Ticketmaster Attraction Search ───────────────────────────

interface TMImage {
  url: string;
  width: number;
  height: number;
  ratio: string;
  fallback: boolean;
}

async function searchTMAttraction(name: string): Promise<string | null> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      keyword: name,
      size: '1',
    });
    const res = await fetch(`${TM_API_BASE}/attractions.json?${params}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const embedded = data._embedded as Record<string, unknown> | undefined;
    const attractions = embedded?.attractions as Array<{ images?: TMImage[] }> | undefined;
    if (!attractions?.length) return null;

    // Verify the attraction name roughly matches to avoid cross-artist mismatches
    const attraction = attractions[0] as { name?: string; images?: TMImage[] };
    if (!attraction.name) return null;
    const tmName = attraction.name.toLowerCase().trim();
    const queryName = name.toLowerCase().trim();
    // Accept if names match or one contains the other (e.g. "Radiohead" vs "Radiohead - Tour")
    if (tmName !== queryName && !tmName.includes(queryName) && !queryName.includes(tmName)) return null;
    const images = attraction.images;
    if (!images?.length) return null;

    // Filter out fallback images AND generic TM placeholders (/dam/c/ paths are category defaults)
    const candidates = images.filter((img) => !img.fallback && img.width > 0 && !img.url.includes('/dam/c/'));
    const medium = candidates
      .filter((img) => img.width >= 300 && img.width <= 640)
      .sort((a, b) => {
        if (a.ratio === '16_9' && b.ratio !== '16_9') return -1;
        if (a.ratio !== '16_9' && b.ratio === '16_9') return 1;
        return b.width - a.width;
      });
    if (medium.length > 0) return medium[0].url;
    if (candidates.length === 0) return null;
    // Fallback: smallest non-fallback above 200px
    const fallback = candidates.sort((a, b) => a.width - b.width).find((img) => img.width >= 200);
    return fallback?.url ?? candidates[0]?.url ?? null;
  } catch {
    return null;
  }
}

// ─── Spotify Artist Search (image only, genres deprecated Nov 2024) ──

async function searchSpotifyImage(name: string): Promise<string | null> {
  try {
    const { getSpotifyToken } = await import('./spotify');
    const token = await getSpotifyToken();
    const params = new URLSearchParams({ q: name, type: 'artist', limit: '1' });

    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, Record<string, unknown>>;
    const artists = data?.artists?.items as Array<{
      name?: string;
      images?: Array<{ url: string; width: number }>;
    }> | undefined;
    if (!artists?.length || !artists[0].images?.length) return null;

    // Verify name match (case-insensitive) to avoid wrong artist images
    const spotName = artists[0].name?.toLowerCase().trim() ?? '';
    const queryName = name.toLowerCase().trim();
    if (spotName !== queryName && !spotName.includes(queryName) && !queryName.includes(spotName)) return null;

    const imgs = artists[0].images;
    const medium = imgs.find((img) => img.width >= 300 && img.width <= 640);
    return medium?.url ?? imgs[imgs.length > 1 ? 1 : 0].url;
  } catch {
    return null;
  }
}

// ─── MusicBrainz Tags (genres) ───────────────────────────────

const MB_API_BASE = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'Encore/1.0.0 (https://github.com/nackbe/encore)';

async function fetchMBGenres(mbid: string): Promise<string[]> {
  try {
    const res = await fetch(`${MB_API_BASE}/artist/${mbid}?inc=tags&fmt=json`, {
      headers: { 'User-Agent': MB_USER_AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { tags?: Array<{ name: string; count: number }> };
    if (!data.tags?.length) return [];

    // Sort by vote count, take top 5, capitalize
    return data.tags
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((t) => t.name);
  } catch {
    return [];
  }
}

// ─── DB Check & Save ──────────────────────────────────────────

interface DBResult {
  id: string;
  image_url: string | null;
}

async function checkDB(name: string, mbid?: string): Promise<DBResult | null> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();

  // Try by MBID first (most precise)
  if (mbid) {
    const { data } = await supabase
      .from('artists')
      .select('id, image_url')
      .eq('musicbrainz_id', mbid)
      .maybeSingle();
    if (data) return data;
  }

  // Fallback by name
  const { data } = await supabase
    .from('artists')
    .select('id, image_url')
    .ilike('name', name)
    .maybeSingle();
  return data ?? null;
}

async function saveArtistToDB(
  artistId: string,
  updates: { image_url?: string; genres?: string[] }
): Promise<void> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  // Only update fields that have values
  const patch: Record<string, unknown> = {};
  if (updates.image_url) patch.image_url = updates.image_url;
  if (updates.genres?.length) patch.genres = updates.genres;
  if (Object.keys(patch).length > 0) {
    await supabase.from('artists').update(patch).eq('id', artistId);
  }
}

// ─── Main Cascade ─────────────────────────────────────────────

export interface ArtistImageResult {
  imageUrl: string | null;
  genres: string[];
}

export async function findArtistImage(
  name: string,
  mbid?: string
): Promise<ArtistImageResult> {
  const log = (source: string, url: string | null) =>
    console.log(`[image-cascade] "${name}"${mbid ? ` (mbid:${mbid.slice(0, 8)}…)` : ''} → ${source}: ${url ? url.slice(0, 80) : 'null'}`);

  // Fetch genres from MusicBrainz in background (needs MBID)
  const genresPromise = mbid ? fetchMBGenres(mbid) : Promise.resolve([]);

  // 1. DB cache — instant if artist already has image
  const dbArtist = await checkDB(name, mbid);
  if (dbArtist?.image_url) {
    log('db-cache', dbArtist.image_url);
    const genres = await genresPromise;
    if (genres.length > 0 && dbArtist) {
      await saveArtistToDB(dbArtist.id, { genres });
    }
    return { imageUrl: dbArtist.image_url, genres };
  }

  // 2. fanart.tv (needs MBID) — most precise, curated HD images
  if (mbid) {
    const fanartImage = await getArtistThumb(mbid);
    if (fanartImage) {
      log('fanart.tv', fanartImage);
      const genres = await genresPromise;
      if (dbArtist) await saveArtistToDB(dbArtist.id, { image_url: fanartImage, genres });
      return { imageUrl: fanartImage, genres };
    }
  }

  // 3. Spotify search — image only (genres deprecated Nov 2024)
  const spotifyImage = await searchSpotifyImage(name);
  if (spotifyImage) {
    log('spotify', spotifyImage);
    const genres = await genresPromise;
    if (dbArtist) await saveArtistToDB(dbArtist.id, { image_url: spotifyImage, genres });
    return { imageUrl: spotifyImage, genres };
  }

  // 4. Ticketmaster attractions — HD but name-only, can mismatch
  const tmImage = await searchTMAttraction(name);
  if (tmImage) {
    log('ticketmaster', tmImage);
    const genres = await genresPromise;
    if (dbArtist) await saveArtistToDB(dbArtist.id, { image_url: tmImage, genres });
    return { imageUrl: tmImage, genres };
  }

  // 5. No image found — UI renders placeholder
  log('none', null);
  const genres = await genresPromise;
  if (dbArtist && genres.length > 0) {
    await saveArtistToDB(dbArtist.id, { genres });
  }
  return { imageUrl: null, genres };
}
