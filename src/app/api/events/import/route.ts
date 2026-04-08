import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/events/import
 * Imports an external event (Setlist.fm, Bandsintown, MusicBrainz, Wikipedia) into global_events.
 * Uses service_role to bypass RLS.
 * Optimized: batch artist lookups and inserts instead of sequential.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { source, source_id, name, date, date_end, city, country, event_type, poster_url, lat, lng, artists } = body;

  if (!source || !source_id || !name || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check if this source_id already exists
  const { data: existing } = await supabase
    .from('global_events')
    .select('id')
    .eq('source', source)
    .eq('source_id', source_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ globalEventId: existing.id });
  }

  // Insert the global event
  const { data: newEvent, error: eventError } = await supabase
    .from('global_events')
    .insert({
      name,
      date,
      date_end: date_end ?? null,
      city: city ?? null,
      country: country ?? null,
      event_type: event_type ?? 'concert',
      poster_url: poster_url ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      source,
      source_id,
      is_past: date <= new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single();

  if (eventError || !newEvent) {
    console.error('Error importing event:', eventError);
    return NextResponse.json({ error: 'Failed to import event' }, { status: 500 });
  }

  // --- Batch artist processing ---
  const artistArr = Array.isArray(artists) ? artists.filter((a: { name?: string }) => a.name) : [];
  if (artistArr.length === 0) {
    return NextResponse.json({ globalEventId: newEvent.id });
  }

  // Normalize all names
  const normalize = (n: string) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const artistsWithNorm = artistArr.map((a: { name: string; image_url?: string; genres?: string[] }) => ({
    ...a,
    normalized: normalize(a.name),
  }));

  // Batch lookup existing artists (chunks of 500)
  const allNormalized = artistsWithNorm.map((a: { normalized: string }) => a.normalized);
  const existingMap = new Map<string, string>(); // normalized → id
  for (let i = 0; i < allNormalized.length; i += 500) {
    const batch = allNormalized.slice(i, i + 500);
    const { data } = await supabase
      .from('artists')
      .select('id, name_normalized')
      .in('name_normalized', batch);
    if (data) {
      for (const a of data) existingMap.set(a.name_normalized, a.id);
    }
  }

  // Insert missing artists in one batch
  const toInsert = artistsWithNorm
    .filter((a: { normalized: string }) => !existingMap.has(a.normalized))
    // Dedup by normalized name
    .filter((a: { normalized: string }, i: number, arr: { normalized: string }[]) =>
      arr.findIndex(x => x.normalized === a.normalized) === i
    )
    .map((a: { name: string; normalized: string; image_url?: string; genres?: string[] }) => ({
      name: a.name,
      name_normalized: a.normalized,
      image_url: a.image_url ?? null,
      genres: a.genres?.length ? a.genres : undefined,
    }));

  if (toInsert.length > 0) {
    // Insert in chunks of 200
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { data, error } = await supabase
        .from('artists')
        .insert(chunk)
        .select('id, name_normalized');

      if (data) {
        for (const a of data) existingMap.set(a.name_normalized, a.id);
      } else if (error) {
        // Fallback: insert one by one on conflict
        for (const item of chunk) {
          const { data: single } = await supabase
            .from('artists')
            .upsert(item as never, { onConflict: 'name_normalized' })
            .select('id, name_normalized')
            .single();
          if (single) existingMap.set(single.name_normalized, single.id);
        }
      }
    }
  }

  // Batch insert artist↔event links
  const seen = new Set<string>();
  const links = artistsWithNorm
    .map((a: { normalized: string }, i: number) => {
      const artistId = existingMap.get(a.normalized);
      if (!artistId || seen.has(artistId)) return null;
      seen.add(artistId);
      return {
        global_event_id: newEvent.id,
        artist_id: artistId,
        role: 'performer' as const,
        billing_order: i,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (links.length > 0) {
    // Insert links in chunks of 500
    for (let i = 0; i < links.length; i += 500) {
      await supabase.from('global_event_artists').insert(links.slice(i, i + 500) as never);
    }
  }

  return NextResponse.json({ globalEventId: newEvent.id });
}
