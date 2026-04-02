import { createAdminClient } from '@/lib/supabase/admin';
import type { SpotifyArtistResult } from '@/types';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Token Management ───────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET environment variables');
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== 'object' ||
    !('access_token' in data) ||
    typeof (data as Record<string, unknown>).access_token !== 'string' ||
    !('expires_in' in data) ||
    typeof (data as Record<string, unknown>).expires_in !== 'number'
  ) {
    throw new Error('Invalid Spotify token response');
  }

  const typed = data as { access_token: string; expires_in: number };
  cachedToken = {
    token: typed.access_token,
    expiresAt: Date.now() + typed.expires_in * 1000 - 60_000, // refresh 1 min early
  };

  return cachedToken.token;
}

// ─── Cache Helpers ──────────────────────────────────────────────

async function getCached<T>(cacheKey: string): Promise<T | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('api_cache')
    .select('response_data, expires_at')
    .eq('cache_key', cacheKey)
    .single();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  return data.response_data as T;
}

async function setCache(cacheKey: string, data: Record<string, unknown>): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  await supabase.from('api_cache').upsert(
    {
      cache_key: cacheKey,
      response_data: data,
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key' }
  );
}

// ─── API Methods ────────────────────────────────────────────────

function validateArtist(item: unknown): item is SpotifyArtistResult {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof (item as Record<string, unknown>).id === 'string' &&
    'name' in item &&
    typeof (item as Record<string, unknown>).name === 'string' &&
    'genres' in item &&
    Array.isArray((item as Record<string, unknown>).genres) &&
    'popularity' in item &&
    typeof (item as Record<string, unknown>).popularity === 'number'
  );
}

export async function searchArtists(query: string): Promise<SpotifyArtistResult[]> {
  const cacheKey = `spotify:search:${query.toLowerCase().trim()}`;
  const cached = await getCached<{ artists: SpotifyArtistResult[] }>(cacheKey);
  if (cached) return cached.artists;

  const token = await getSpotifyToken();
  const params = new URLSearchParams({
    q: query,
    type: 'artist',
    limit: '20',
  });

  const response = await fetch(`${SPOTIFY_API_BASE}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Spotify search failed: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  const items = (data as Record<string, Record<string, unknown>>)?.artists?.items;

  if (!Array.isArray(items)) {
    throw new Error('Invalid Spotify search response structure');
  }

  const artists = items.filter(validateArtist);

  await setCache(cacheKey, { artists });
  return artists;
}

export async function getArtist(spotifyId: string): Promise<SpotifyArtistResult> {
  const cacheKey = `spotify:artist:${spotifyId}`;
  const cached = await getCached<SpotifyArtistResult>(cacheKey);
  if (cached) return cached;

  const token = await getSpotifyToken();
  const response = await fetch(`${SPOTIFY_API_BASE}/artists/${spotifyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Spotify get artist failed: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!validateArtist(data)) {
    throw new Error('Invalid Spotify artist response');
  }

  await setCache(cacheKey, data as unknown as Record<string, unknown>);
  return data;
}

export async function getArtistsBatch(spotifyIds: string[]): Promise<SpotifyArtistResult[]> {
  if (spotifyIds.length === 0) return [];
  if (spotifyIds.length > 50) {
    throw new Error('Spotify batch endpoint supports a maximum of 50 IDs');
  }

  const token = await getSpotifyToken();
  const params = new URLSearchParams({ ids: spotifyIds.join(',') });

  const response = await fetch(`${SPOTIFY_API_BASE}/artists?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Spotify batch artists failed: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  const items = (data as Record<string, unknown>)?.artists;

  if (!Array.isArray(items)) {
    throw new Error('Invalid Spotify batch response structure');
  }

  const artists = items.filter(validateArtist);

  // Cache each artist individually
  await Promise.all(
    artists.map((artist) =>
      setCache(`spotify:artist:${artist.id}`, artist as unknown as Record<string, unknown>)
    )
  );

  return artists;
}
