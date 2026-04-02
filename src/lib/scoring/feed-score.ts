import type { FeedScoreFactors } from '@/types';

const DEFAULT_WEIGHTS: FeedScoreFactors = {
  followedArtist: 8,
  collectionArtist: 5,
  genreMatch: 3,
  sameCity: 2,
  sameCountry: 1,
  popularityNormalized: 1,
  historicBadge: 4,
  thisWeek: 2,
  thisMonth: 1,
};

export interface FeedScoreInput {
  /** Whether the event features an artist the user follows */
  isFollowedArtist: boolean;
  /** Whether the event features an artist already in the user's collection */
  isCollectionArtist: boolean;
  /** Number of matching genres between event artists and user preferences */
  matchingGenreCount: number;
  /** Whether the event is in the same city as the user */
  isSameCity: boolean;
  /** Whether the event is in the same country as the user */
  isSameCountry: boolean;
  /** Spotify popularity score of the main artist (0-100) */
  artistPopularity: number;
  /** Whether the event has any historic badges attached */
  hasHistoricBadge: boolean;
  /** The date of the event as an ISO string */
  eventDate: string;
}

/**
 * Calculates a feed relevance score for an event based on user preferences.
 * Higher scores indicate more relevant events and should appear first in the feed.
 */
export function calculateFeedScore(
  input: FeedScoreInput,
  weights: FeedScoreFactors = DEFAULT_WEIGHTS
): number {
  let score = 0;

  if (input.isFollowedArtist) {
    score += weights.followedArtist;
  }

  if (input.isCollectionArtist) {
    score += weights.collectionArtist;
  }

  // Each matching genre adds to the score, capped at 3 genres
  const genreMatches = Math.min(input.matchingGenreCount, 3);
  score += genreMatches * weights.genreMatch;

  if (input.isSameCity) {
    score += weights.sameCity;
  }

  if (input.isSameCountry) {
    score += weights.sameCountry;
  }

  // Normalize popularity from 0-100 to a 0-1 range, then apply weight
  const normalizedPopularity = Math.max(0, Math.min(100, input.artistPopularity)) / 100;
  score += normalizedPopularity * weights.popularityNormalized;

  if (input.hasHistoricBadge) {
    score += weights.historicBadge;
  }

  // Time-based bonuses
  const now = new Date();
  const eventDate = new Date(input.eventDate);
  const diffMs = eventDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays >= 0 && diffDays <= 7) {
    score += weights.thisWeek;
  } else if (diffDays > 7 && diffDays <= 30) {
    score += weights.thisMonth;
  }

  return Math.round(score * 100) / 100;
}
