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

export async function searchSetlists(
  artistName: string,
  page = 1
): Promise<SetlistFmPageResponse> {
  const params = new URLSearchParams({
    artistName,
    p: String(page),
  });

  const response = await fetch(`${SETLISTFM_API_BASE}/search/setlists?${params}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { setlist: [], total: 0, page: 1, itemsPerPage: 20 };
    }
    throw new Error(`Setlist.fm search failed: ${response.status} ${response.statusText}`);
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
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { setlist: [], total: 0, page: 1, itemsPerPage: 20 };
    }
    throw new Error(
      `Setlist.fm artist setlists failed: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();
  return parsePageResponse(data);
}

export async function getSetlistDetail(setlistId: string): Promise<SetlistFmSetlist> {
  const response = await fetch(`${SETLISTFM_API_BASE}/setlist/${setlistId}`, {
    headers: getHeaders(),
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
