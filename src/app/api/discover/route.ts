import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

const PAGE_SIZE = 20;

// In-memory cache for forward geocoding results
const forwardGeoCache = new Map<string, { lat: number; lng: number; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_SIZE = 200;

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Forward-geocode a city/country to lat/lng via Nominatim */
async function forwardGeocode(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const q = [city, country].filter(Boolean).join(', ');
  if (!q) return null;

  // Check cache
  const cached = forwardGeoCache.get(q);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { lat: cached.lat, lng: cached.lng };
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'Encore-App/1.0 (concert-tracker)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      if (forwardGeoCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = forwardGeoCache.keys().next().value!;
        forwardGeoCache.delete(oldestKey);
      }
      forwardGeoCache.set(q, { ...result, ts: Date.now() });
      return result;
    }
  } catch {
    // Geocode failed — fall through to standard mode
  }
  return null;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed } = rateLimit(ip, { limit: 60, windowSec: 60 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = await createClient();
  const params = req.nextUrl.searchParams;

  // Pagination
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  // Filters
  const city = params.get('city') ?? '';
  const country = params.get('country') ?? '';
  const eventType = params.get('eventType') ?? '';
  const search = params.get('search') ?? '';
  const sort = params.get('sort') ?? 'date_asc';

  // Exact match mode — skip proximity, filter by exact city/country
  const exact = params.get('exact') === '1';

  // Proximity coords (from map click, or will be resolved from city/country)
  let lat = params.get('lat') ? parseFloat(params.get('lat')!) : null;
  let lng = params.get('lng') ? parseFloat(params.get('lng')!) : null;

  // If city or country provided without lat/lng and NOT exact mode, forward-geocode
  if (!exact && (city || country) && (lat === null || lng === null)) {
    const coords = await forwardGeocode(city, country);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  const useProximity = !exact && lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
  const today = new Date().toISOString().split('T')[0];

  const selectFields = `
    id, name, date, city, country, event_type, poster_url, is_past, lat, lng,
    venues:venue_id (id, name, city, country),
    global_event_artists (
      role, billing_order,
      artists:artist_id (id, name, image_url, genres)
    )
  `;

  // ── Proximity mode: fetch all future events, sort by distance ──
  if (useProximity) {
    let query = supabase
      .from('global_events')
      .select(selectFields, { count: 'exact' })
      .gte('date', today);

    if (eventType) query = query.eq('event_type', eventType);
    if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);

    const { data: allEvents, count, error } = await query as unknown as {
      data: Array<Record<string, unknown> & { lat: number | null; lng: number | null }> | null;
      count: number | null;
      error: { message: string } | null;
    };

    if (error) {
      console.error('Discover API error (proximity):', error.message);
      return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
    }

    // Calculate distance and sort: same city/country first, then by distance
    const pLat = lat!;
    const pLng = lng!;
    const withDistance = (allEvents ?? []).map((e) => ({
      ...e,
      _distance: e.lat != null && e.lng != null
        ? haversineKm(pLat, pLng, e.lat, e.lng)
        : 999999,
      _sameCity: city && typeof e.city === 'string' && e.city.toLowerCase() === city.toLowerCase(),
      _sameCountry: country && typeof e.country === 'string' && e.country.toLowerCase() === country.toLowerCase(),
    }));

    // Priority: same city first, then same country, then rest — within each group by distance
    withDistance.sort((a, b) => {
      if (a._sameCity !== b._sameCity) return a._sameCity ? -1 : 1;
      if (a._sameCountry !== b._sameCountry) return a._sameCountry ? -1 : 1;
      return a._distance - b._distance;
    });

    const paginated = withDistance.slice(offset, offset + PAGE_SIZE);
    const total = withDistance.length;

    return NextResponse.json({
      events: paginated,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: total > offset + PAGE_SIZE,
    });
  }

  // ── Standard mode (exact match or no location): date-sorted with pagination ──
  let query = supabase
    .from('global_events')
    .select(selectFields, { count: 'exact' })
    .gte('date', today);

  // Geo filters (exact match)
  if (city) {
    query = query.ilike('city', city);
  } else if (country) {
    query = query.ilike('country', country);
  }

  if (eventType) query = query.eq('event_type', eventType);
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);

  switch (sort) {
    case 'date_desc':
      query = query.order('date', { ascending: false });
      break;
    case 'name':
      query = query.order('name', { ascending: true });
      break;
    case 'date_asc':
    default:
      query = query.order('date', { ascending: true });
      break;
  }

  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: events, count, error } = await query;

  if (error) {
    console.error('Discover API error (standard):', error.message);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }

  return NextResponse.json({
    events: events ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    hasMore: (count ?? 0) > offset + PAGE_SIZE,
  });
}
