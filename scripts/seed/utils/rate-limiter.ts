/**
 * Per-source rate limiter.
 * Ensures minimum interval between requests to the same source.
 * Used by all crawlers to respect API rate limits.
 */

import { SOURCES, type SourceConfig } from '../config/source-config';

const lastRequestTime = new Map<string, number>();

/**
 * Wait until it's safe to make a request to the given source.
 * Resolves immediately if enough time has passed since the last request.
 */
export async function throttle(source: string): Promise<void> {
  const config = SOURCES[source];
  if (!config) return;

  const now = Date.now();
  const last = lastRequestTime.get(source) ?? 0;
  const elapsed = now - last;

  if (elapsed < config.minInterval) {
    const wait = config.minInterval - elapsed;
    await new Promise((r) => setTimeout(r, wait));
  }

  lastRequestTime.set(source, Date.now());
}

/**
 * Fetch with rate limiting, timeout, and User-Agent for a specific source.
 */
export async function rateLimitedFetch(
  source: string,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const config = SOURCES[source];
  if (!config) throw new Error(`Unknown source: ${source}`);

  await throttle(source);

  return fetch(url, {
    ...init,
    headers: {
      'User-Agent': config.userAgent,
      Accept: 'application/json',
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(config.timeout),
  });
}

export function getSourceConfig(source: string): SourceConfig {
  const config = SOURCES[source];
  if (!config) throw new Error(`Unknown source: ${source}`);
  return config;
}
