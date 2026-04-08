/**
 * Unified Event Search — queries 3 sources in parallel:
 *   1. Local database (global_events) — instant, $0
 *   2. Setlist.fm API (9.6M events, best concert coverage)
 *   3. MusicBrainz Events (open data, commercial-safe)
 *
 * Festivals are pre-loaded in DB via seed script (see scripts/seed/).
 * Ticketmaster is NOT used for event search — only for images.
 */

import { searchSetlists, searchArtists as searchSFMArtists } from './setlistfm';
import { searchEvents as searchMBEvents, getEvent as getMBEvent } from './musicbrainz';
import type { SetlistFmSetlist } from '@/types';
import type { MusicBrainzEvent } from './musicbrainz';

// ─── Types ─────────────────────────────────────────────────────

export interface UnifiedSearchResult {
  source: 'local' | 'setlistfm' | 'bandsintown' | 'musicbrainz';
  source_id: string;
  name: string;
  date: string;
  date_end?: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  event_type: string;
  poster_url: string | null;
  artists: Array<{
    name: string;
    image_url: string | null;
    mbid?: string;
  }>;
  lat: number | null;
  lng: number | null;
  local_event_id?: string;
  /** When found via artist search, the artist name that matched */
  matched_artist?: string;
}

// ─── Helpers ───────────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  CO: 'Colombia', MX: 'México', AR: 'Argentina', ES: 'España',
  US: 'United States', CL: 'Chile', PE: 'Perú', BR: 'Brasil',
  GB: 'United Kingdom', DE: 'Germany', FR: 'France', IT: 'Italy',
  CA: 'Canada', JP: 'Japan', AU: 'Australia', NL: 'Netherlands',
  BE: 'Belgium', PT: 'Portugal', CH: 'Switzerland', AT: 'Austria',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', IE: 'Ireland',
  EC: 'Ecuador', VE: 'Venezuela', UY: 'Uruguay', PA: 'Panamá',
  CR: 'Costa Rica', GT: 'Guatemala', DO: 'República Dominicana',
  BO: 'Bolivia', PY: 'Paraguay', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', CU: 'Cuba', PR: 'Puerto Rico',
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/** Setlist.fm date dd-MM-yyyy → yyyy-MM-dd */
function parseSetlistDate(eventDate: string): string {
  const parts = eventDate.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return '';
}

// ─── Local DB Search ───────────────────────────────────────────

interface LocalEventRow {
  id: string;
  name: string;
  date: string;
  date_end: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  event_type: string;
  poster_url: string | null;
  source: string;
  source_id: string | null;
  global_event_artists: Array<{
    artist_id: string;
    artists: { name: string; image_url: string | null } | null;
  }> | null;
}

function mapLocalEvents(
  events: LocalEventRow[],
  searchQuery?: string,
  artistMatchedIds?: Set<string>,
): UnifiedSearchResult[] {
  const queryLower = searchQuery?.toLowerCase();
  return events.map((e) => {
    const artists = (() => {
      const seen = new Set<string>();
      return e.global_event_artists?.map((ea) => ({
        name: ea.artists?.name ?? '',
        image_url: ea.artists?.image_url ?? null,
      })).filter((a) => {
        if (!a.name || seen.has(a.name)) return false;
        seen.add(a.name);
        return true;
      }) ?? [];
    })();

    // If this event was found via artist search, find which artist matched
    let matched_artist: string | undefined;
    if (artistMatchedIds?.has(e.id) && queryLower) {
      matched_artist = artists.find(a =>
        a.name.toLowerCase().includes(queryLower)
      )?.name;
    }

    return {
      source: 'local' as const,
      source_id: e.source_id ?? e.id,
      name: e.name,
      date: e.date,
      date_end: e.date_end,
      city: e.city,
      country: e.country,
      venue: null,
      event_type: e.event_type,
      poster_url: e.poster_url,
      lat: e.lat,
      lng: e.lng,
      local_event_id: e.id,
      artists,
      matched_artist,
    };
  });
}

export async function searchLocal(query: string, year?: string): Promise<UnifiedSearchResult[]> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  // Strip year from query so "radiohead 2018" matches "Radiohead en Foro Sol"
  const textQuery = year ? query.replace(year, '').replace(/\s{2,}/g, ' ').trim() : query;

  // Search 1: By event name or city (existing behavior)
  let q = supabase
    .from('global_events')
    .select(`
      id, name, date, date_end, city, country, lat, lng, event_type,
      poster_url, source, source_id,
      global_event_artists (
        artist_id,
        artists:artist_id (name, image_url)
      )
    `)
    .or(`name.ilike.%${textQuery}%,city.ilike.%${textQuery}%`);

  if (year) {
    q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  }

  const { data: byName } = await q
    .order('date', { ascending: false })
    .limit(10) as unknown as { data: LocalEventRow[] | null };

  // Search 2: By artist name → find festivals/events where that artist performed
  // Two-step approach because Supabase can't filter parent rows by embedded relation values
  // Step 2a: Find matching artist IDs
  const { data: matchingArtists } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', `%${textQuery}%`)
    .limit(5) as unknown as { data: Array<{ id: string }> | null };

  let byArtistEvents: LocalEventRow[] = [];

  if (matchingArtists && matchingArtists.length > 0) {
    const artistIds = matchingArtists.map(a => a.id);

    // Step 2b: Find event IDs linked to those artists
    const { data: links } = await supabase
      .from('global_event_artists')
      .select('global_event_id')
      .in('artist_id', artistIds)
      .limit(50) as unknown as { data: Array<{ global_event_id: string }> | null };

    if (links && links.length > 0) {
      const eventIds = [...new Set(links.map(l => l.global_event_id))];

      // Step 2c: Fetch full event data for those IDs
      let evtQ = supabase
        .from('global_events')
        .select(`
          id, name, date, date_end, city, country, lat, lng, event_type,
          poster_url, source, source_id,
          global_event_artists (
            artist_id,
            artists:artist_id (name, image_url)
          )
        `)
        .in('id', eventIds.slice(0, 20));

      if (year) {
        evtQ = evtQ.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
      }

      const { data: events } = await evtQ
        .order('date', { ascending: false })
        .limit(10) as unknown as { data: LocalEventRow[] | null };

      byArtistEvents = events ?? [];
    }
  }

  // Merge both result sets, dedup by event id
  const seenIds = new Set<string>();
  const allEvents: LocalEventRow[] = [];

  for (const e of byName ?? []) {
    if (!seenIds.has(e.id)) {
      seenIds.add(e.id);
      allEvents.push(e);
    }
  }

  // Track which events came from artist search (to show matched artist in UI)
  const artistMatchedEventIds = new Set<string>();
  for (const e of byArtistEvents) {
    if (!seenIds.has(e.id)) {
      seenIds.add(e.id);
      artistMatchedEventIds.add(e.id);
      allEvents.push(e);
    }
  }

  // Sort by date descending, limit to 15
  allEvents.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  return mapLocalEvents(allEvents.slice(0, 15), textQuery, artistMatchedEventIds);
}

// ─── Setlist.fm Normalization ──────────────────────────────────

function normalizeSetlistResults(setlists: SetlistFmSetlist[]): UnifiedSearchResult[] {
  return setlists.slice(0, 15).map((s) => {
    const cc = s.venue?.city?.country?.code;
    const date = parseSetlistDate(s.eventDate);

    return {
      source: 'setlistfm' as const,
      source_id: s.id,
      name: s.tour?.name
        ? `${s.artist.name} — ${s.tour.name}`
        : `${s.artist.name} at ${s.venue?.name ?? 'Unknown Venue'}`,
      date,
      city: s.venue?.city?.name ?? null,
      country: cc ? (COUNTRY_NAMES[cc] ?? s.venue?.city?.country?.name ?? cc) : null,
      venue: s.venue?.name ?? null,
      event_type: 'concert',
      poster_url: null,
      lat: s.venue?.city?.coords?.lat ?? null,
      lng: s.venue?.city?.coords?.long ?? null,
      artists: [{ name: s.artist.name, image_url: null, mbid: s.artist.mbid }],
    };
  }).filter((r) => r.date);
}

// ─── MusicBrainz Normalization ─────────────────────────────────

function normalizeMBResults(events: MusicBrainzEvent[]): UnifiedSearchResult[] {
  return events.slice(0, 15).map((e) => {
    // MB search returns relations with `artist`/`place` objects directly
    // (no `target-type` field — that's only on the detail endpoint)
    const artists = e.relations
      ?.filter((r) => r.artist != null)
      .map((r) => ({
        name: r.artist!.name,
        image_url: null,
        mbid: r.artist!.id,
      })) ?? [];

    const place = e.relations?.find((r) => r.place != null);
    const venue = place?.place;

    // MB search doesn't return area/coordinates on place — try to extract city
    // from event name patterns like "Artist at Venue, City" or "Artist in City"
    let city: string | null = venue?.area?.name ?? null;
    if (!city) {
      const inMatch = e.name.match(/\bin\s+([A-Z][a-zA-Zé\u00C0-\u024F\s]+)/);
      if (inMatch) city = inMatch[1].trim();
    }

    const mbType = e.type?.toLowerCase() ?? '';
    let eventType = 'concert';
    if (mbType.includes('festival')) eventType = 'festival';

    // For festivals with artists, show count in name
    const displayName = eventType === 'festival' && artists.length > 0
      ? `${e.name} — ${artists.length} artists`
      : e.name;

    return {
      source: 'musicbrainz' as const,
      source_id: e.id,
      name: displayName,
      date: e['life-span']?.begin ?? '',
      city,
      country: null,
      venue: venue?.name ?? null,
      event_type: eventType,
      poster_url: null,
      lat: venue?.coordinates?.latitude ?? null,
      lng: venue?.coordinates?.longitude ?? null,
      artists,
    };
  }).filter((r) => r.date);
}

// ─── Deduplication ─────────────────────────────────────────────

function deduplicateResults(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
  const seen = new Map<string, UnifiedSearchResult>();

  for (const r of results) {
    const key = `${normalize(r.name)}|${r.date}`;

    if (!seen.has(key)) {
      seen.set(key, r);
    } else {
      const existing = seen.get(key)!;
      const priority: Record<string, number> = {
        local: 4, setlistfm: 3, bandsintown: 2, musicbrainz: 1,
      };
      if ((priority[r.source] ?? 0) > (priority[existing.source] ?? 0)) {
        seen.set(key, {
          ...r,
          poster_url: r.poster_url ?? existing.poster_url,
          artists: r.artists.length > 0 ? r.artists : existing.artists,
          lat: r.lat ?? existing.lat,
          lng: r.lng ?? existing.lng,
        });
      } else {
        // Merge missing data into existing
        seen.set(key, {
          ...existing,
          poster_url: existing.poster_url ?? r.poster_url,
          artists: existing.artists.length > 0 ? existing.artists : r.artists,
          lat: existing.lat ?? r.lat,
          lng: existing.lng ?? r.lng,
        });
      }
    }
  }

  return Array.from(seen.values());
}

// ─── Query Parser ──────────────────────────────────────────────

const FESTIVAL_KEYWORDS = [
  'festival', 'fest', 'lollapalooza', 'coachella', 'primavera', 'bonnaroo',
  'glastonbury', 'tomorrowland', 'sonar', 'mad cool', 'rock al parque',
  'estéreo picnic', 'estereo picnic', 'vive latino', 'corona capital',
  'download', 'reading', 'leeds', 'rock in rio', 'summerfest', 'ultra',
  'creamfields', 'electric daisy', 'edc', 'austin city limits', 'acl',
];

interface ParsedQuery {
  artist?: string;    // artist name (if detected)
  venue?: string;     // venue or festival name (if detected)
  text: string;       // full query without year
  year?: string;      // e.g. "2017"
  isFestival: boolean; // true if query looks like a festival search
}

function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();

  // Extract 4-digit year (1970-2039)
  const yearMatch = trimmed.match(/\b(19[7-9]\d|20[0-3]\d)\b/);
  const year = yearMatch?.[1];
  const withoutYear = year
    ? trimmed.replace(year, '').replace(/\s{2,}/g, ' ').trim()
    : trimmed;

  // Check if it's a festival search
  const lowerText = withoutYear.toLowerCase();
  const isFestival = FESTIVAL_KEYWORDS.some((kw) => lowerText.includes(kw));

  // Try to split "Artist at Venue" or "Artist en Venue"
  const atMatch = withoutYear.match(/^(.+?)\s+(?:at|en|@)\s+(.+)$/i);
  if (atMatch) {
    return {
      artist: atMatch[1].trim(),
      venue: atMatch[2].trim(),
      text: withoutYear,
      year,
      isFestival: isFestival || FESTIVAL_KEYWORDS.some((kw) => atMatch[2].toLowerCase().includes(kw)),
    };
  }

  return { text: withoutYear, year, isFestival };
}

// ─── Main Search Function ──────────────────────────────────────

export interface UnifiedSearchResponse {
  results: UnifiedSearchResult[];
  errors: Array<{ source: string; message: string }>;
}

async function safeSource(
  name: string,
  fn: () => Promise<UnifiedSearchResult[]>
): Promise<{ name: string; results: UnifiedSearchResult[]; error?: string }> {
  const start = Date.now();
  const RETRYABLE = new Set([429, 503, 504]);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const results = await fn();
      console.log(`[search] ${name}: ${results.length} results in ${Date.now() - start}ms${attempt > 0 ? ` (retry ${attempt})` : ''}`);
      return { name, results };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Retry once for transient errors (429, 503, timeout)
      const isRetryable = attempt === 0 && (
        RETRYABLE.has(Number(msg.match(/\b(429|503|504)\b/)?.[1])) ||
        msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('AbortError')
      );
      if (isRetryable) {
        const delay = 1000 * (attempt + 1); // 1s backoff
        console.warn(`[search] ${name}: ${msg} — retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      console.error(`[search] ${name}: FAILED in ${Date.now() - start}ms — ${msg}`);
      return { name, results: [], error: msg };
    }
  }
  return { name, results: [] };
}

export async function unifiedEventSearch(query: string): Promise<UnifiedSearchResponse> {
  const errors: Array<{ source: string; message: string }> = [];
  const parsed = parseQuery(query);

  console.log(`[search] Query: "${query}" → text="${parsed.text}", artist=${parsed.artist ?? '-'}, venue=${parsed.venue ?? '-'}, year=${parsed.year ?? '-'}, festival=${parsed.isFestival}`);
  const globalStart = Date.now();

  // 3 sources in parallel. Each source catches its own errors via safeSource.
  // Promise.allSettled ensures one failure never blocks the others.
  const settled = await Promise.allSettled([
    safeSource('local', () => searchLocal(query, parsed.year)),

    safeSource('setlistfm', async () => {
      const allSetlists: SetlistFmSetlist[] = [];

      if (parsed.artist && parsed.venue) {
        // "Metallica at Mad Cool Festival 2022"
        // Strip "festival/fest" from venue for better matching
        const venueClean = parsed.venue.replace(/\s*(festival|fest)\s*/gi, ' ').trim() || parsed.venue;

        // Search venue first to discover the city, then artist + city
        const byVenue = await searchSetlists({ venueName: venueClean, year: parsed.year });

        // If venue+year found nothing, try without year
        if (byVenue.setlist.length === 0 && parsed.year) {
          const byVenueNoYear = await searchSetlists({ venueName: venueClean });
          byVenue.setlist = byVenueNoYear.setlist;
        }

        allSetlists.push(...byVenue.setlist.slice(0, 10));

        // Use the city from venue results to find the artist at that city
        // (festivals often use different physical venues, e.g., Mad Cool → IFEMA)
        const venueCity = byVenue.setlist[0]?.venue?.city?.name;
        if (venueCity) {
          const byArtistCity = await searchSetlists({
            artistName: parsed.artist,
            cityName: venueCity,
            year: parsed.year,
          });
          allSetlists.push(...byArtistCity.setlist.slice(0, 10));
        } else {
          // No city from venue — just search artist with year
          const byArtist = await searchSetlists({ artistName: parsed.artist, year: parsed.year });
          allSetlists.push(...byArtist.setlist.slice(0, 10));
        }
      } else if (parsed.isFestival) {
        // Festivals are pre-loaded in DB via seed — SFM has no festival endpoint.
        // DB local search handles this (runs in parallel). SFM fallback: try as artist name.
        console.log(`[search] Festival path: "${parsed.text}" — relying on DB local + MB`);
        const r = await searchSetlists({ artistName: parsed.text, year: parsed.year });
        allSetlists.push(...r.setlist);
      } else if (parsed.year) {
        // "the cure 2016" → MBID lookup for precision
        const artists = await searchSFMArtists(parsed.text);
        if (artists.length > 0) {
          const r = await searchSetlists({ artistMbid: artists[0].mbid, year: parsed.year });
          allSetlists.push(...r.setlist);
        } else {
          const r = await searchSetlists({ artistName: parsed.text, year: parsed.year });
          allSetlists.push(...r.setlist);
        }

        // If no results, try last word as city
        // "foo fighters bogota 2019" → artist="foo fighters", city="bogota", year=2019
        if (allSetlists.length === 0) {
          const words = parsed.text.split(/\s+/);
          if (words.length >= 2) {
            const maybeCity = words[words.length - 1];
            const maybeArtist = words.slice(0, -1).join(' ');
            const r2 = await searchSetlists({ artistName: maybeArtist, cityName: maybeCity, year: parsed.year });
            allSetlists.push(...r2.setlist);
          }
        }
      } else {
        // Simple artist search: "radiohead", "alcoli" → MBID lookup for fuzzy matching
        const artists = await searchSFMArtists(parsed.text);
        console.log(`[search] SFM artist lookup "${parsed.text}" → ${artists.length} artists${artists.length > 0 ? ` (best: "${artists[0].name}", mbid: ${artists[0].mbid})` : ''}`);
        if (artists.length > 0) {
          const r = await searchSetlists({ artistMbid: artists[0].mbid });
          allSetlists.push(...r.setlist);
        }
        // Also try by name (catches cases where artist search misses but setlist search works)
        if (allSetlists.length === 0) {
          const r = await searchSetlists({ artistName: parsed.text });
          allSetlists.push(...r.setlist);
        }

        // If no results, try splitting last word as city
        // "foo fighters bogota" → artist="foo fighters", city="bogota"
        if (allSetlists.length === 0) {
          const words = parsed.text.split(/\s+/);
          if (words.length >= 2) {
            const maybeCity = words[words.length - 1];
            const maybeArtist = words.slice(0, -1).join(' ');
            const r2 = await searchSetlists({ artistName: maybeArtist, cityName: maybeCity });
            allSetlists.push(...r2.setlist);
          }
        }
      }

      return normalizeSetlistResults(allSetlists);
    }),

    safeSource('musicbrainz', async () => {
      // MB Lucene `begin:` field doesn't work reliably with text queries.
      // Strategy: search by NAME only (no year in query) → filter by year →
      // enrich year-matched results with lookup (don't waste lookups on wrong years).
      const mbQuery = parsed.artist ?? parsed.text;
      console.log(`[search] MB query: "${mbQuery}" (year filter: ${parsed.year ?? 'none'})`);

      const events = await searchMBEvents(mbQuery);
      console.log(`[search] MB search: ${events.length} results`);

      const normalizedQuery = normalize(mbQuery);

      // Pre-filter by year BEFORE spending lookups
      let candidates = events;
      if (parsed.year) {
        candidates = events.filter((e) => {
          const begin = e['life-span']?.begin;
          return begin && begin.startsWith(parsed.year!);
        });
        console.log(`[search] MB year filter ${parsed.year}: ${candidates.length}/${events.length}`);
        // If year filter found nothing, return empty — don't show wrong-year results
        if (candidates.length === 0) return [];
      }

      // Enrich top results with lookup to get artist-rels + place-rels.
      // MB search does NOT return relations — only lookup does.
      // Rate limit: 1 req/sec strict, max 5 lookups per search.
      const enriched: MusicBrainzEvent[] = [];
      let lookupCount = 0;
      for (const e of candidates) {
        if (lookupCount < 5) {
          try {
            const detail = await getMBEvent(e.id);
            if (detail) {
              console.log(`[search] MB detail "${detail.name}": ${detail.relations?.length ?? 0} relations`);
              enriched.push(detail);
              lookupCount++;
              continue;
            }
          } catch {
            // Lookup failed, use search result as-is
          }
        }
        enriched.push(e);
      }

      // Post-enrichment filter: query must appear in event name OR in any artist name
      // (MB text search matches individual words loosely, e.g. "manuel" in "Emmanuel")
      const filtered = enriched.filter((e) => {
        const eventName = normalize(e.name);
        if (eventName.includes(normalizedQuery)) return true;
        // Check artist relations (available after lookup)
        const artistNames = e.relations
          ?.filter((r) => r.artist != null)
          .map((r) => normalize(r.artist!.name)) ?? [];
        return artistNames.some((name) => name.includes(normalizedQuery));
      });
      console.log(`[search] MB relevance filter: ${filtered.length}/${enriched.length} (query: "${normalizedQuery}")`);

      return normalizeMBResults(filtered);
    }),
  ]);

  // Collect results from settled promises
  const sources = settled
    .filter((s): s is PromiseFulfilledResult<{ name: string; results: UnifiedSearchResult[]; error?: string }> =>
      s.status === 'fulfilled')
    .map((s) => s.value);

  // Log rejected promises (shouldn't happen since safeSource catches, but just in case)
  for (const s of settled) {
    if (s.status === 'rejected') {
      const msg = s.reason instanceof Error ? s.reason.message : 'Unknown error';
      console.error(`[search] Source rejected: ${msg}`);
      errors.push({ source: 'unknown', message: msg });
    }
  }

  const allResults: UnifiedSearchResult[] = [];
  const sfmSource = sources.find((s) => s.name === 'setlistfm');
  const mbSource = sources.find((s) => s.name === 'musicbrainz');
  for (const s of sources) {
    allResults.push(...s.results);
    if (s.error) errors.push({ source: s.name, message: s.error });
  }

  // Cross-source boost: if SFM found nothing but MB found artists with MBIDs,
  // use the MBID to search SFM (handles partial names like "alcoli" → "Alcolirykoz")
  if (sfmSource && sfmSource.results.length === 0 && mbSource && mbSource.results.length > 0) {
    const mbids = new Set<string>();
    for (const r of mbSource.results) {
      for (const a of r.artists) {
        if (a.mbid) mbids.add(a.mbid);
      }
    }
    if (mbids.size > 0) {
      const firstMbid = [...mbids][0];
      console.log(`[search] Cross-source: SFM empty, using MB artist mbid ${firstMbid}`);
      try {
        const r = await searchSetlists({ artistMbid: firstMbid });
        if (r.setlist.length > 0) {
          const extra = normalizeSetlistResults(r.setlist);
          console.log(`[search] Cross-source: SFM found ${extra.length} results via MB mbid`);
          allResults.push(...extra);
        }
      } catch {
        // Non-critical — already have MB results
      }
    }
  }

  const deduplicated = deduplicateResults(allResults);

  deduplicated.sort((a, b) => {
    if (a.source === 'local' && b.source !== 'local') return -1;
    if (a.source !== 'local' && b.source === 'local') return 1;
    return (b.date ?? '').localeCompare(a.date ?? '');
  });

  const final = deduplicated.slice(0, 20);
  console.log(`[search] Total: ${final.length} results in ${Date.now() - globalStart}ms (errors: ${errors.length})`);

  return { results: final, errors };
}
