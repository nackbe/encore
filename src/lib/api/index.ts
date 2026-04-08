// ─── API Clients ────────────────────────────────────────────────
export { searchSetlists, getArtistSetlists, getSetlistDetail } from './setlistfm';
export type { SetlistSearchParams } from './setlistfm';

export { getArtist as getBITArtist, getArtistPastEvents } from './bandsintown';
export type { BandsintownArtist, BandsintownEvent } from './bandsintown';

export { searchEvents as searchMBEvents, getEvent as getMBEvent, searchArtists as searchMBArtists } from './musicbrainz';
export type { MusicBrainzEvent, MusicBrainzArtist } from './musicbrainz';

export { searchEvents as searchTMEvents, getEvent as getTMEvent } from './ticketmaster';
export type { SearchEventsParams } from './ticketmaster';

export { getSpotifyToken, searchArtists as searchSpotifyArtists, getArtist as getSpotifyArtist, getArtistsBatch } from './spotify';

// ─── Unified Search ─────────────────────────────────────────────
export { unifiedEventSearch } from './unified-search';
export type { UnifiedSearchResult, UnifiedSearchResponse } from './unified-search';
