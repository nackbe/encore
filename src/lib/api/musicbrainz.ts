const MB_API_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'Encore/1.0.0 (https://github.com/nackbe/encore)';

// ─── Types ─────────────────────────────────────────────────────

export interface MusicBrainzEvent {
  id: string;
  name: string;
  type: string; // "Concert", "Festival", etc.
  'life-span': {
    begin: string | null;
    end: string | null;
  };
  relations: Array<{
    type: string; // "main performer", "held at", "support act", etc.
    'target-type': string; // "artist", "place"
    artist?: {
      id: string;
      name: string;
      'sort-name': string;
    };
    place?: {
      id: string;
      name: string;
      coordinates?: { latitude: number; longitude: number };
      area?: { name: string };
    };
  }>;
}

export interface MusicBrainzArtist {
  id: string; // MBID
  name: string;
  'sort-name': string;
  country?: string;
  disambiguation?: string;
  type?: string;
}

interface MBSearchResponse<T> {
  count: number;
  offset: number;
  events?: T[];
  artists?: T[];
}

// ─── API Methods ────────────────────────────────────────────────

/** Search events by query string */
export async function searchEvents(query: string): Promise<MusicBrainzEvent[]> {
  try {
    const params = new URLSearchParams({
      query,
      fmt: 'json',
      limit: '15',
    });

    const res = await fetch(`${MB_API_BASE}/event?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MBSearchResponse<MusicBrainzEvent>;
    return data.events ?? [];
  } catch {
    return [];
  }
}


/** Get event detail with artist and place relations */
export async function getEvent(mbid: string): Promise<MusicBrainzEvent | null> {
  try {
    const params = new URLSearchParams({
      inc: 'artist-rels place-rels',
      fmt: 'json',
    });

    const res = await fetch(`${MB_API_BASE}/event/${mbid}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as MusicBrainzEvent;
  } catch {
    return null;
  }
}

/** Search artists (returns MBIDs — useful for cross-referencing APIs) */
export async function searchArtists(query: string): Promise<MusicBrainzArtist[]> {
  try {
    const params = new URLSearchParams({
      query,
      fmt: 'json',
      limit: '5',
    });

    const res = await fetch(`${MB_API_BASE}/artist?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MBSearchResponse<MusicBrainzArtist>;
    return data.artists ?? [];
  } catch {
    return [];
  }
}
