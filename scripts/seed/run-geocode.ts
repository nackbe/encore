/**
 * Batch geocode festivals: city+country → lat/lng
 * Uses a hardcoded map of major cities + Nominatim as fallback.
 *
 * Usage: npx tsx scripts/seed/run-geocode.ts [--limit N] [--dry-run]
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '..', '..', '.env.local') });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Major cities used in music festivals — covers ~80% of cases
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Latin America
  'bogotá': { lat: 4.711, lng: -74.072 }, 'bogota': { lat: 4.711, lng: -74.072 },
  'buenos aires': { lat: -34.604, lng: -58.382 },
  'santiago': { lat: -33.449, lng: -70.669 },
  'mexico city': { lat: 19.433, lng: -99.133 }, 'ciudad de méxico': { lat: 19.433, lng: -99.133 },
  'lima': { lat: -12.046, lng: -77.043 },
  'medellín': { lat: 6.217, lng: -75.568 }, 'medellin': { lat: 6.217, lng: -75.568 },
  'são paulo': { lat: -23.551, lng: -46.634 }, 'sao paulo': { lat: -23.551, lng: -46.634 },
  'rio de janeiro': { lat: -22.907, lng: -43.173 },
  'montevideo': { lat: -34.901, lng: -56.164 },
  'quito': { lat: -0.180, lng: -78.468 },
  'asunción': { lat: -25.264, lng: -57.575 }, 'asuncion': { lat: -25.264, lng: -57.575 },
  'guadalajara': { lat: 20.659, lng: -103.350 },
  'monterrey': { lat: 25.687, lng: -100.317 },
  'cartagena': { lat: 10.391, lng: -75.514 },
  'cali': { lat: 3.437, lng: -76.522 },
  'barranquilla': { lat: 10.964, lng: -74.796 },
  'panamá': { lat: 8.984, lng: -79.519 }, 'panama city': { lat: 8.984, lng: -79.519 },
  'san josé': { lat: 9.929, lng: -84.088 },
  'havana': { lat: 23.113, lng: -82.367 },
  'santo domingo': { lat: 18.487, lng: -69.929 },
  'la paz': { lat: -16.490, lng: -68.119 },
  'córdoba': { lat: -31.420, lng: -64.189 }, 'cordoba': { lat: -31.420, lng: -64.189 },
  'rosario': { lat: -32.947, lng: -60.639 },
  'viña del mar': { lat: -33.025, lng: -71.552 },
  'concepción': { lat: -36.827, lng: -73.050 },
  'curitiba': { lat: -25.429, lng: -49.271 },
  'belo horizonte': { lat: -19.919, lng: -43.938 },
  'brasília': { lat: -15.780, lng: -47.929 },
  'recife': { lat: -8.058, lng: -34.871 },
  'salvador': { lat: -12.972, lng: -38.512 },
  'porto alegre': { lat: -30.033, lng: -51.230 },

  // North America
  'new york': { lat: 40.713, lng: -74.006 }, 'new york city': { lat: 40.713, lng: -74.006 },
  'los angeles': { lat: 34.052, lng: -118.244 },
  'chicago': { lat: 41.878, lng: -87.630 },
  'austin': { lat: 30.267, lng: -97.743 },
  'nashville': { lat: 36.163, lng: -86.781 },
  'san francisco': { lat: 37.775, lng: -122.419 },
  'miami': { lat: 25.762, lng: -80.192 },
  'seattle': { lat: 47.606, lng: -122.332 },
  'denver': { lat: 39.739, lng: -104.990 },
  'portland': { lat: 45.505, lng: -122.675 },
  'atlanta': { lat: 33.749, lng: -84.388 },
  'detroit': { lat: 42.331, lng: -83.046 },
  'philadelphia': { lat: 39.953, lng: -75.164 },
  'boston': { lat: 42.360, lng: -71.059 },
  'dallas': { lat: 32.777, lng: -96.797 },
  'houston': { lat: 29.760, lng: -95.370 },
  'las vegas': { lat: 36.169, lng: -115.140 },
  'phoenix': { lat: 33.449, lng: -112.074 },
  'minneapolis': { lat: 44.978, lng: -93.265 },
  'new orleans': { lat: 29.951, lng: -90.072 },
  'oakland': { lat: 37.805, lng: -122.272 },
  'san diego': { lat: 32.716, lng: -117.161 },
  'toronto': { lat: 43.653, lng: -79.383 },
  'montreal': { lat: 45.502, lng: -73.567 }, 'montréal': { lat: 45.502, lng: -73.567 },
  'vancouver': { lat: 49.283, lng: -123.121 },
  'ottawa': { lat: 45.422, lng: -75.697 },
  'calgary': { lat: 51.045, lng: -114.072 },
  'edmonton': { lat: 53.546, lng: -113.494 },
  'indio': { lat: 33.721, lng: -116.215 }, // Coachella
  'manchester': { lat: 42.991, lng: -71.463 },
  'dover': { lat: 39.158, lng: -75.524 }, // Firefly
  'george': { lat: 47.079, lng: -119.852 }, // The Gorge
  'pilton': { lat: 51.158, lng: -2.584 }, // Glastonbury
  'louisville': { lat: 38.253, lng: -85.760 },
  'asbury park': { lat: 40.220, lng: -74.012 },
  'columbia': { lat: 34.000, lng: -81.035 },

  // Europe
  'london': { lat: 51.507, lng: -0.128 },
  'paris': { lat: 48.857, lng: 2.352 },
  'berlin': { lat: 52.520, lng: 13.405 },
  'madrid': { lat: 40.417, lng: -3.704 },
  'barcelona': { lat: 41.386, lng: 2.170 },
  'amsterdam': { lat: 52.370, lng: 4.895 },
  'brussels': { lat: 50.850, lng: 4.352 },
  'lisbon': { lat: 38.722, lng: -9.139 }, 'lisboa': { lat: 38.722, lng: -9.139 },
  'rome': { lat: 41.902, lng: 12.496 },
  'milan': { lat: 45.464, lng: 9.190 },
  'vienna': { lat: 48.208, lng: 16.374 },
  'zurich': { lat: 47.377, lng: 8.542 },
  'geneva': { lat: 46.205, lng: 6.145 },
  'prague': { lat: 50.076, lng: 14.438 },
  'budapest': { lat: 47.497, lng: 19.040 },
  'warsaw': { lat: 52.230, lng: 21.012 },
  'copenhagen': { lat: 55.676, lng: 12.569 },
  'stockholm': { lat: 59.329, lng: 18.069 },
  'oslo': { lat: 59.914, lng: 10.752 },
  'helsinki': { lat: 60.170, lng: 24.938 },
  'dublin': { lat: 53.350, lng: -6.260 },
  'edinburgh': { lat: 55.953, lng: -3.189 },
  'glasgow': { lat: 55.861, lng: -4.250 },
  'manchester': { lat: 53.483, lng: -2.244 },
  'birmingham': { lat: 52.486, lng: -1.891 },
  'hamburg': { lat: 53.551, lng: 9.994 },
  'munich': { lat: 48.135, lng: 11.582 },
  'frankfurt': { lat: 50.110, lng: 8.682 },
  'cologne': { lat: 50.938, lng: 6.960 },
  'rotterdam': { lat: 51.925, lng: 4.479 },
  'antwerp': { lat: 51.222, lng: 4.402 },
  'porto': { lat: 41.158, lng: -8.629 },
  'seville': { lat: 37.389, lng: -5.984 }, 'sevilla': { lat: 37.389, lng: -5.984 },
  'valencia': { lat: 39.470, lng: -0.376 },
  'bilbao': { lat: 43.263, lng: -2.935 },
  'athens': { lat: 37.984, lng: 23.728 },
  'istanbul': { lat: 41.009, lng: 28.978 },
  'belgrade': { lat: 44.787, lng: 20.457 },
  'zagreb': { lat: 45.815, lng: 15.982 },
  'bucharest': { lat: 44.427, lng: 26.103 },
  'sofia': { lat: 42.698, lng: 23.322 },
  'bratislava': { lat: 48.149, lng: 17.107 },
  'riga': { lat: 56.946, lng: 24.106 },
  'vilnius': { lat: 54.687, lng: 25.280 },
  'tallinn': { lat: 59.437, lng: 24.754 },
  'reykjavik': { lat: 64.147, lng: -21.943 },
  'gothenburg': { lat: 57.709, lng: 11.975 },
  'leeds': { lat: 53.801, lng: -1.549 },
  'bristol': { lat: 51.455, lng: -2.588 },
  'brighton': { lat: 50.823, lng: -0.141 },
  'reading': { lat: 51.455, lng: -0.978 },
  'nyon': { lat: 46.383, lng: 6.240 }, // Paléo
  'roskilde': { lat: 55.642, lng: 12.080 },
  'werchter': { lat: 50.960, lng: 4.699 },
  'hilvarenbeek': { lat: 51.489, lng: 5.138 },
  'landgraaf': { lat: 50.898, lng: 6.018 }, // Pinkpop
  'clisson': { lat: 47.087, lng: -1.282 }, // Hellfest
  'wacken': { lat: 54.022, lng: 9.363 },
  'donnington': { lat: 52.780, lng: -1.393 }, 'donington': { lat: 52.780, lng: -1.393 },
  'nürburg': { lat: 50.334, lng: 6.943 }, // Rock am Ring
  'finsbury park': { lat: 51.565, lng: -0.103 },
  'benicàssim': { lat: 40.046, lng: 0.062 }, 'benicassim': { lat: 40.046, lng: 0.062 },

  // Asia & Oceania
  'tokyo': { lat: 35.682, lng: 139.692 },
  'seoul': { lat: 37.566, lng: 126.978 },
  'osaka': { lat: 34.694, lng: 135.502 },
  'bangkok': { lat: 13.756, lng: 100.502 },
  'singapore': { lat: 1.352, lng: 103.820 },
  'hong kong': { lat: 22.319, lng: 114.169 },
  'melbourne': { lat: -37.814, lng: 144.963 },
  'sydney': { lat: -33.869, lng: 151.209 },
  'brisbane': { lat: -27.468, lng: 153.028 },
  'perth': { lat: -31.951, lng: 115.861 },
  'auckland': { lat: -36.849, lng: 174.763 },
  'byron bay': { lat: -28.643, lng: 153.612 }, // Splendour/Bluesfest
  'fuji': { lat: 35.210, lng: 138.616 }, // Fuji Rock

  // Africa
  'cape town': { lat: -33.925, lng: 18.424 },
  'johannesburg': { lat: -26.205, lng: 28.050 },
  'nairobi': { lat: -1.286, lng: 36.817 },
  'lagos': { lat: 6.525, lng: 3.379 },
  'marrakech': { lat: 31.630, lng: -7.982 },
};

function lookupCity(city: string, country: string | null): { lat: number; lng: number } | null {
  const norm = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Direct lookup
  if (CITY_COORDS[norm]) return CITY_COORDS[norm];

  // Try without country qualifier
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (norm.includes(key) || key.includes(norm)) return coords;
  }

  return null;
}

// Nominatim fallback with rate limiting
const nominatimCache = new Map<string, { lat: number; lng: number } | null>();
let lastNominatimCall = 0;

async function geocodeNominatim(city: string, country: string | null): Promise<{ lat: number; lng: number } | null> {
  const query = country ? `${city}, ${country}` : city;
  const key = query.toLowerCase();

  if (nominatimCache.has(key)) return nominatimCache.get(key)!;

  // Enforce 1.5s between requests
  const now = Date.now();
  const wait = Math.max(0, 1500 - (now - lastNominatimCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Encore-App/1.0 (concert-tracker; nestro.ed@gmail.com)' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 429) {
      console.log(' [RATE LIMITED - skipping Nominatim]');
      return null;
    }
    if (!res.ok) { nominatimCache.set(key, null); return null; }

    const data = await res.json();
    if (!data || data.length === 0) { nominatimCache.set(key, null); return null; }

    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    nominatimCache.set(key, result);
    return result;
  } catch {
    nominatimCache.set(key, null);
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    limit: (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1], 10) : 5000; })(),
    dryRun: args.includes('--dry-run'),
    skipNominatim: args.includes('--skip-nominatim'),
  };
}

async function main() {
  const { limit, dryRun, skipNominatim } = parseArgs();
  console.log(`Geocoding festivals (limit: ${limit}, dry: ${dryRun}, nominatim: ${!skipNominatim})\n`);

  const { data: events, error } = await supabase
    .from('global_events')
    .select('id, name, city, country')
    .eq('event_type', 'festival')
    .is('lat', null)
    .not('city', 'is', null)
    .limit(limit);

  if (error) { console.error('DB error:', error.message); process.exit(1); }
  if (!events || events.length === 0) { console.log('No festivals to geocode.'); return; }

  console.log(`Found ${events.length} festivals to geocode\n`);

  let found = 0, notFound = 0, errors = 0, cacheHits = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    process.stdout.write(`  ${i + 1}/${events.length} | ${event.city}, ${event.country ?? '?'}`);

    try {
      // Try hardcoded map first (instant)
      let coords = lookupCity(event.city!, event.country);
      if (coords) cacheHits++;

      // Fallback to Nominatim
      if (!coords && !skipNominatim) {
        coords = await geocodeNominatim(event.city!, event.country);
      }

      if (coords) {
        found++;
        process.stdout.write(` → ${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`);

        if (!dryRun) {
          await supabase
            .from('global_events')
            .update({ lat: coords.lat, lng: coords.lng })
            .eq('id', event.id);
        }
      } else {
        notFound++;
        process.stdout.write(' → not found');
      }

      console.log(dryRun ? ' [DRY]' : '');
    } catch (err) {
      errors++;
      console.log(` error: ${err instanceof Error ? err.message : err}`);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`\n  --- ${i + 1}/${events.length} | Found: ${found} (${cacheHits} from map) | Not found: ${notFound} | Err: ${errors} ---\n`);
    }
  }

  console.log('\n=== Geocoding Complete ===');
  console.log(`Processed:  ${events.length}`);
  console.log(`Found:      ${found} (${cacheHits} from city map, ${found - cacheHits} from Nominatim)`);
  console.log(`Not found:  ${notFound}`);
  console.log(`Errors:     ${errors}`);
  if (dryRun) console.log('(DRY RUN — no changes saved)');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
