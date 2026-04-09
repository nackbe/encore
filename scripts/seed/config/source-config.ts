/**
 * Rate limits, User-Agents, and timeouts for each external API source.
 * Used by the rate limiter to enforce per-source throttling.
 */

export interface SourceConfig {
  /** Minimum milliseconds between requests */
  minInterval: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** User-Agent header (required by some APIs) */
  userAgent: string;
  /** Max retries for transient errors */
  maxRetries: number;
}

export const SOURCES: Record<string, SourceConfig> = {
  wikipedia: {
    minInterval: 1000, // 1 req/sec (polite crawling)
    timeout: 10000,
    userAgent: 'Encore/1.0.0 (https://github.com/nackbe/encore; concert-tracker)',
    maxRetries: 2,
  },
  musicbrainz: {
    minInterval: 1100, // 1 req/sec STRICT — IP ban if exceeded
    timeout: 10000,
    userAgent: 'Encore/1.0.0 (https://github.com/nackbe/encore)',
    maxRetries: 2,
  },
  wikidata: {
    minInterval: 1000, // 1 req/sec (polite)
    timeout: 10000,
    userAgent: 'Encore/1.0.0 (https://github.com/nackbe/encore; concert-tracker)',
    maxRetries: 2,
  },
  fanart: {
    minInterval: 500, // ~2 req/sec (free tier)
    timeout: 5000,
    userAgent: 'Encore/1.0.0',
    maxRetries: 1,
  },
  spotify: {
    minInterval: 200, // ~5 req/sec (images only, no genres)
    timeout: 5000,
    userAgent: 'Encore/1.0.0',
    maxRetries: 1,
  },
  ticketmaster: {
    minInterval: 200, // 5 req/sec (5000/day limit)
    timeout: 5000,
    userAgent: 'Encore/1.0.0',
    maxRetries: 1,
  },
};

/** API base URLs */
export const API_URLS = {
  wikipedia: 'https://en.wikipedia.org/w/api.php',
  wikipediaEs: 'https://es.wikipedia.org/w/api.php',
  wikipediaPt: 'https://pt.wikipedia.org/w/api.php',
  musicbrainz: 'https://musicbrainz.org/ws/2',
  wikidata: 'https://www.wikidata.org/w/api.php',
  wikidataSparql: 'https://query.wikidata.org/sparql',
} as const;
