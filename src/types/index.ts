// ─── Domain Enums ───────────────────────────────────────────────

export type EventType = 'concert' | 'festival' | 'club_show' | 'theater' | 'special';

export type MoodType = 'epic' | 'intimate' | 'euphoric' | 'nostalgic' | 'transcendent' | 'rainy' | 'energetic' | 'melancholic' | 'peaceful' | 'chaotic' | 'emotional' | 'surreal';

export type BadgeType =
  | 'last_concert'
  | 'comeback'
  | 'anniversary'
  | 'reunion'
  | 'debut'
  | 'before_fame';

export type VenueType = 'stadium' | 'arena' | 'theater' | 'club' | 'bar' | 'outdoor' | 'other';

export type ArtistRole = 'headliner' | 'support' | 'performer' | 'special_guest';

export type SubscriptionTier = 'free' | 'pro';

// ─── Collection / Discover ──────────────────────────────────────

export type SortField = 'date' | 'name' | 'artist' | 'venue' | 'rating';
export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  direction: SortDirection;
  label: string;
}

export interface FilterOptions {
  eventTypes: EventType[];
  moods: MoodType[];
  genres: string[];
  city: string | null;
  country: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  artistId: string | null;
  venueId: string | null;
  hasPhotos: boolean | null;
  hasBadges: boolean | null;
  ratingMin: number | null;
  ratingMax: number | null;
}

// ─── Feed Scoring ───────────────────────────────────────────────

export interface FeedScoreFactors {
  followedArtist: number;
  collectionArtist: number;
  genreMatch: number;
  sameCity: number;
  sameCountry: number;
  popularityNormalized: number;
  historicBadge: number;
  thisWeek: number;
  thisMonth: number;
}

// ─── API Response Shapes ────────────────────────────────────────

export interface SpotifyArtistResult {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: Array<{ url: string; height: number; width: number }>;
  external_urls: { spotify: string };
}

export interface SetlistFmSetlist {
  id: string;
  eventDate: string;
  artist: { mbid: string; name: string };
  venue: {
    name: string;
    city: {
      id?: string;
      name: string;
      state?: string;
      stateCode?: string;
      country: { name: string; code: string };
      coords?: { lat: number; long: number };
    };
  };
  tour?: { name: string };
  sets: {
    set: Array<{
      name?: string;
      song: Array<{ name: string; info?: string }>;
    }>;
  };
}

export interface TicketmasterEvent {
  id: string;
  name: string;
  dates: {
    start: { localDate: string; localTime?: string };
    status: { code: string };
  };
  images: Array<{ url: string; width: number; height: number }>;
  _embedded?: {
    venues?: Array<{
      name: string;
      city: { name: string };
      country: { countryCode: string };
      location?: { latitude: string; longitude: string };
    }>;
    attractions?: Array<{
      id: string;
      name: string;
      classifications?: Array<{ genre?: { name: string } }>;
    }>;
  };
}
