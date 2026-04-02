import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

// In-memory cache for reverse geocoding results (survives between requests in the same serverless instance)
const geocodeCache = new Map<string, { city: string; country: string; countryCode: string; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_SIZE = 500;

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = rateLimit(ip, { limit: 30, windowSec: 60 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const params = req.nextUrl.searchParams;
  const lat = params.get('lat');
  const lng = params.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  // Check cache first
  const cacheKey = `${lat},${lng}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ city: cached.city, country: cached.country, countryCode: cached.countryCode });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=en`,
      {
        headers: {
          'User-Agent': 'Encore-App/1.0 (concert-tracker)',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Nominatim returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    const city =
      data.address?.city ??
      data.address?.town ??
      data.address?.municipality ??
      data.address?.state ??
      '';
    const country = data.address?.country ?? '';
    const countryCode = (data.address?.country_code ?? '').toUpperCase();

    // Cache the result
    if (geocodeCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = geocodeCache.keys().next().value!;
      geocodeCache.delete(oldestKey);
    }
    geocodeCache.set(cacheKey, { city, country, countryCode, ts: Date.now() });

    return NextResponse.json({ city, country, countryCode });
  } catch {
    return NextResponse.json({ error: 'Geocode request failed' }, { status: 502 });
  }
}
