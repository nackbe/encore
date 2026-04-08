import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/events/import
 * Imports an external event (Setlist.fm, Bandsintown, MusicBrainz) into global_events.
 * Uses service_role to bypass RLS (authenticated users can only insert source='user_submitted').
 * Returns the global_event_id.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { source, source_id, name, date, date_end, city, country, event_type, poster_url, lat, lng, artists } = body;

  if (!source || !source_id || !name || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  console.log(`[import] Start: "${name}" (${source}:${source_id})`);
  const supabase = createAdminClient();

  // Check if this source_id already exists
  const { data: existing } = await supabase
    .from('global_events')
    .select('id')
    .eq('source', source)
    .eq('source_id', source_id)
    .maybeSingle();

  if (existing) {
    console.log(`[import] Already exists: ${existing.id}`);
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

  // Insert artists and link them
  const artistArr = Array.isArray(artists) ? artists : [];
  for (let i = 0; i < artistArr.length; i++) {
    const artist = artistArr[i];
    if (!artist.name) continue;

    const normalized = artist.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Upsert artist (check by normalized name)
    const { data: existingArtist } = await supabase
      .from('artists')
      .select('id')
      .eq('name_normalized', normalized)
      .maybeSingle();

    let artistId: string;
    if (existingArtist) {
      artistId = existingArtist.id;
      // Update image/genres if artist is missing them and we have data from cascade
      const patch: Record<string, unknown> = {};
      if (artist.image_url) {
        const { data: current } = await supabase
          .from('artists')
          .select('image_url, genres')
          .eq('id', artistId)
          .single();
        if (current && !current.image_url) patch.image_url = artist.image_url;
        if (current && (!current.genres || current.genres.length === 0) && artist.genres?.length) {
          patch.genres = artist.genres;
        }
      } else if (artist.genres?.length) {
        const { data: current } = await supabase
          .from('artists')
          .select('genres')
          .eq('id', artistId)
          .single();
        if (current && (!current.genres || current.genres.length === 0)) {
          patch.genres = artist.genres;
        }
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from('artists').update(patch).eq('id', artistId);
      }
    } else {
      const { data: newArtist, error: artistError } = await supabase
        .from('artists')
        .insert({
          name: artist.name,
          name_normalized: normalized,
          image_url: artist.image_url ?? null,
          genres: artist.genres?.length ? artist.genres : null,
        })
        .select('id')
        .single();

      if (artistError || !newArtist) continue;
      artistId = newArtist.id;
    }

    // Link artist to event
    await supabase
      .from('global_event_artists')
      .insert({
        global_event_id: newEvent.id,
        artist_id: artistId,
        role: 'performer',
        billing_order: i,
      })
      .select()
      .maybeSingle();
  }

  console.log(`[import] Done: ${newEvent.id} (${artistArr.length} artists)`);
  return NextResponse.json({ globalEventId: newEvent.id });
}
