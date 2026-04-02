export { getSpotifyToken, searchArtists, getArtist, getArtistsBatch } from './spotify';
export { searchSetlists, getArtistSetlists, getSetlistDetail } from './setlistfm';
export { searchEvents, getEvent } from './ticketmaster';
export type { SearchEventsParams } from './ticketmaster';

import { searchArtists } from './spotify';
import { searchSetlists } from './setlistfm';
import { searchEvents } from './ticketmaster';
import type { SpotifyArtistResult, SetlistFmSetlist, TicketmasterEvent } from '@/types';

// ─── Unified Search ─────────────────────────────────────────────

export interface UnifiedSearchResult {
  artists: SpotifyArtistResult[];
  setlists: SetlistFmSetlist[];
  events: TicketmasterEvent[];
  errors: Array<{ source: string; message: string }>;
}

/**
 * Searches across Spotify, Setlist.fm, and Ticketmaster in parallel.
 * Partial failures are captured in the `errors` array rather than
 * throwing, so the caller always gets whatever data is available.
 */
export async function unifiedSearch(query: string): Promise<UnifiedSearchResult> {
  const result: UnifiedSearchResult = {
    artists: [],
    setlists: [],
    events: [],
    errors: [],
  };

  const [spotifyResult, setlistResult, tmResult] = await Promise.allSettled([
    searchArtists(query),
    searchSetlists(query),
    searchEvents({ keyword: query }),
  ]);

  if (spotifyResult.status === 'fulfilled') {
    result.artists = spotifyResult.value;
  } else {
    result.errors.push({ source: 'spotify', message: spotifyResult.reason?.message ?? 'Unknown error' });
  }

  if (setlistResult.status === 'fulfilled') {
    result.setlists = setlistResult.value.setlist;
  } else {
    result.errors.push({ source: 'setlistfm', message: setlistResult.reason?.message ?? 'Unknown error' });
  }

  if (tmResult.status === 'fulfilled') {
    result.events = tmResult.value.events;
  } else {
    result.errors.push({ source: 'ticketmaster', message: tmResult.reason?.message ?? 'Unknown error' });
  }

  return result;
}
