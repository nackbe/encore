/**
 * Retry with exponential backoff for transient errors.
 */

import { getSourceConfig } from './rate-limiter';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface RetryOptions {
  /** Source name for max retries config */
  source: string;
  /** Override max retries */
  maxRetries?: number;
  /** Base delay in ms (doubles each retry) */
  baseDelay?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  const config = getSourceConfig(opts.source);
  const maxRetries = opts.maxRetries ?? config.maxRetries;
  const baseDelay = opts.baseDelay ?? 1000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on final attempt
      if (attempt === maxRetries) break;

      // Check if retryable
      const isRetryable =
        lastError.message.includes('timeout') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('AbortError') ||
        RETRYABLE_STATUS.has(extractStatus(lastError.message));

      if (!isRetryable) break;

      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[retry] ${opts.source}: attempt ${attempt + 1}/${maxRetries} — waiting ${delay}ms — ${lastError.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError!;
}

function extractStatus(msg: string): number {
  const match = msg.match(/\b(429|500|502|503|504)\b/);
  return match ? Number(match[1]) : 0;
}
