const BIT_API_BASE = 'https://rest.bandsintown.com';

function getAppId(): string {
  const appId = process.env.BANDSINTOWN_APP_ID;
  if (!appId) {
    throw new Error('Missing BANDSINTOWN_APP_ID environment variable');
  }
  return appId;
}

// ─── Types ─────────────────────────────────────────────────────

export interface BandsintownArtist {
  id: string;
  name: string;
  image_url: string;
  thumb_url: string;
  mbid: string;
  tracker_count: number;
  upcoming_event_count: number;
}

export interface BandsintownEvent {
  id: string;
  artist_id: string;
  datetime: string; // ISO 8601
  title: string;
  description: string;
  venue: {
    name: string;
    city: string;
    region: string;
    country: string;
    latitude: string;
    longitude: string;
  };
  lineup: string[];
  offers: Array<{ type: string; url: string; status: string }>;
}

// ─── API Methods ────────────────────────────────────────────────

/** Get artist info (name, image, mbid, tracker count) */
export async function getArtist(artistName: string): Promise<BandsintownArtist | null> {
  try {
    const encoded = encodeURIComponent(artistName);
    const res = await fetch(
      `${BIT_API_BASE}/artists/${encoded}?app_id=${getAppId()}`,
      { signal: AbortSignal.timeout(5000), cache: 'no-store' as const }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.name !== 'string') return null;
    return data as BandsintownArtist;
  } catch {
    return null;
  }
}

/** Get past events for an artist */
export async function getArtistPastEvents(
  artistName: string,
  dateRange?: { start: string; end: string }
): Promise<BandsintownEvent[]> {
  try {
    const encoded = encodeURIComponent(artistName);
    const dateParam = dateRange
      ? `${dateRange.start},${dateRange.end}`
      : 'past';

    const res = await fetch(
      `${BIT_API_BASE}/artists/${encoded}/events?app_id=${getAppId()}&date=${dateParam}`,
      { signal: AbortSignal.timeout(5000), cache: 'no-store' as const }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data as BandsintownEvent[];
  } catch {
    return [];
  }
}
