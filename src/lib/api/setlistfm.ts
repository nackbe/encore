import type { SetlistFmSetlist } from '@/types';

const SETLISTFM_API_BASE = 'https://api.setlist.fm/rest/1.0';

function getHeaders(): HeadersInit {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) {
    throw new Error('Missing SETLISTFM_API_KEY environment variable');
  }
  return {
    'x-api-key': apiKey,
    Accept: 'application/json',
    'Accept-Language': 'es',
  };
}

// ─── Response Validation ────────────────────────────────────────

interface SetlistFmPageResponse {
  setlist: SetlistFmSetlist[];
  total: number;
  page: number;
  itemsPerPage: number;
}

function validateSetlist(item: unknown): item is SetlistFmSetlist {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.eventDate === 'string' &&
    typeof obj.artist === 'object' &&
    obj.artist !== null &&
    typeof (obj.artist as Record<string, unknown>).name === 'string' &&
    typeof obj.venue === 'object' &&
    obj.venue !== null
  );
}

function parsePageResponse(data: unknown): SetlistFmPageResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid setlist.fm response');
  }

  const obj = data as Record<string, unknown>;
  const setlists = Array.isArray(obj.setlist) ? obj.setlist.filter(validateSetlist) : [];

  return {
    setlist: setlists,
    total: typeof obj.total === 'number' ? obj.total : 0,
    page: typeof obj.page === 'number' ? obj.page : 1,
    itemsPerPage: typeof obj.itemsPerPage === 'number' ? obj.itemsPerPage : 20,
  };
}

// ─── API Methods ────────────────────────────────────────────────

export interface SetlistSearchParams {
  artistName?: string;
  artistMbid?: string;
  cityName?: string;
  cityId?: string;
  year?: string;
  venueName?: string;
  tourName?: string;
  state?: string;
  page?: number;
}

export async function searchSetlists(
  params: string | SetlistSearchParams,
  page = 1
): Promise<SetlistFmPageResponse> {
  // Support legacy string-only call (artistName)
  const searchParams = typeof params === 'string'
    ? { artistName: params, page }
    : { ...params, page: params.page ?? page };

  const urlParams = new URLSearchParams({ p: String(searchParams.page ?? 1) });
  if (searchParams.artistName) urlParams.set('artistName', searchParams.artistName);
  if (searchParams.artistMbid) urlParams.set('artistMbid', searchParams.artistMbid);
  if (searchParams.cityName) urlParams.set('cityName', searchParams.cityName);
  if (searchParams.year) urlParams.set('year', searchParams.year);
  if (searchParams.venueName) urlParams.set('venueName', searchParams.venueName);
  if (searchParams.tourName) urlParams.set('tourName', searchParams.tourName);
  if (searchParams.cityId) urlParams.set('cityId', searchParams.cityId);
  if (searchParams.state) urlParams.set('state', searchParams.state);

  const response = await fetch(`${SETLISTFM_API_BASE}/search/setlists?${urlParams}`, {
    headers: getHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    if (response.status !== 404) {
      console.warn(`[setlistfm] searchSetlists ${response.status} ${response.statusText}`);
    }
    return { setlist: [], total: 0, page: 1, itemsPerPage: 20 };
  }

  const data: unknown = await response.json();
  return parsePageResponse(data);
}

export async function getArtistSetlists(
  mbid: string,
  page = 1
): Promise<SetlistFmPageResponse> {
  const params = new URLSearchParams({ p: String(page) });

  const response = await fetch(`${SETLISTFM_API_BASE}/artist/${mbid}/setlists?${params}`, {
    headers: getHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    if (response.status !== 404) {
      console.warn(`[setlistfm] getArtistSetlists ${response.status} ${response.statusText}`);
    }
    return { setlist: [], total: 0, page: 1, itemsPerPage: 20 };
  }

  const data: unknown = await response.json();
  return parsePageResponse(data);
}

export interface SetlistFmArtist {
  mbid: string;
  name: string;
  sortName: string;
  disambiguation: string;
}

/** Search artists by name — returns first page of matches */
export async function searchArtists(
  artistName: string
): Promise<SetlistFmArtist[]> {
  const params = new URLSearchParams({ artistName, p: '1', sort: 'relevance' });

  const response = await fetch(`${SETLISTFM_API_BASE}/search/artists?${params}`, {
    headers: getHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(4000),
  });

  if (!response.ok) return [];

  const data = await response.json() as { artist?: SetlistFmArtist[] };
  return data.artist ?? [];
}

// ─── Venue Search & Setlists ───────────────────────────────────

export interface SetlistFmVenue {
  id: string;
  name: string;
  city?: {
    id: string;
    name: string;
    state?: string;
    stateCode?: string;
    coords?: { lat: number; long: number };
    country?: { code: string; name: string };
  };
}

/** Search venues by name, optionally filtered by city */
export async function searchVenues(name: string, cityName?: string): Promise<SetlistFmVenue[]> {
  const params = new URLSearchParams({ name, p: '1' });
  if (cityName) params.set('cityName', cityName);

  const response = await fetch(`${SETLISTFM_API_BASE}/search/venues?${params}`, {
    headers: getHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(4000),
  });

  if (!response.ok) return [];

  const data = await response.json() as { venue?: SetlistFmVenue[] };
  return data.venue ?? [];
}

/** Get setlists at a specific venue by venue ID */
export async function getVenueSetlists(
  venueId: string,
  page = 1
): Promise<SetlistFmPageResponse> {
  const params = new URLSearchParams({ p: String(page) });

  const response = await fetch(`${SETLISTFM_API_BASE}/venue/${venueId}/setlists?${params}`, {
    headers: getHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    if (response.status !== 404) {
      console.warn(`[setlistfm] getVenueSetlists ${response.status} ${response.statusText}`);
    }
    return { setlist: [], total: 0, page: 1, itemsPerPage: 20 };
  }

  const data: unknown = await response.json();
  return parsePageResponse(data);
}

export async function getSetlistDetail(setlistId: string): Promise<SetlistFmSetlist> {
  const response = await fetch(`${SETLISTFM_API_BASE}/setlist/${setlistId}`, {
    headers: getHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(
      `Setlist.fm setlist detail failed: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();
  if (!validateSetlist(data)) {
    throw new Error('Invalid setlist.fm setlist response');
  }

  return data;
}
