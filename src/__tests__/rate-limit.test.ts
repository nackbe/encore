import { describe, it, expect } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const ip = `test-allow-${Date.now()}`;
    const result = rateLimit(ip, { limit: 5, windowSec: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests over the limit', () => {
    const ip = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(ip, { limit: 3, windowSec: 60 });
    }
    const result = rateLimit(ip, { limit: 3, windowSec: 60 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks different IPs independently', () => {
    const ts = Date.now();
    const ip1 = `test-ip1-${ts}`;
    const ip2 = `test-ip2-${ts}`;

    for (let i = 0; i < 3; i++) {
      rateLimit(ip1, { limit: 3, windowSec: 60 });
    }

    const result1 = rateLimit(ip1, { limit: 3, windowSec: 60 });
    const result2 = rateLimit(ip2, { limit: 3, windowSec: 60 });

    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
  });

  it('counts down remaining correctly', () => {
    const ip = `test-count-${Date.now()}`;
    const r1 = rateLimit(ip, { limit: 3, windowSec: 60 });
    const r2 = rateLimit(ip, { limit: 3, windowSec: 60 });
    const r3 = rateLimit(ip, { limit: 3, windowSec: 60 });

    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });
});
