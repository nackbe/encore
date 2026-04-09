import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import type { UserEvent, Venue, Artist, UserEventArtist, GlobalEvent } from '@/lib/supabase/types';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Star,
  Music,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { DeleteEventButton } from '@/components/events/DeleteEventButton';

type UserEventWithJoins = UserEvent & {
  global_events: (GlobalEvent & { venues: Venue | null }) | null;
  user_event_artists: Array<UserEventArtist & { artists: Artist }>;
};

interface EventPageProps {
  params: { id: string; locale: string };
}

export default async function EventPage({
  params: { id, locale },
}: EventPageProps) {
  const t = await getTranslations('event');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: event } = await supabase
    .from('user_events')
    .select(
      `
      *,
      global_events:global_event_id (
        *,
        venues:venue_id (*)
      ),
      user_event_artists (
        *,
        artists:artist_id (*)
      )
    `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: UserEventWithJoins | null };

  if (!event) {
    notFound();
  }

  const globalEvent = event.global_events;
  const venue = globalEvent?.venues ?? null;

  const artists = (() => {
    const raw = event.user_event_artists ?? [];
    // Deduplicate by artist_id and sort alphabetically
    const seen = new Set<string>();
    return raw
      .filter((ea) => {
        if (seen.has(ea.artist_id)) return false;
        seen.add(ea.artist_id);
        return true;
      })
      .sort((a, b) => a.artists.name.localeCompare(b.artists.name));
  })();

  const city = event.custom_event_city ?? venue?.city ?? '';
  const venueName = venue?.name ?? '';
  const eventName = event.custom_event_name ?? globalEvent?.name ?? '';
  const eventDate = event.custom_event_date ?? globalEvent?.date ?? '';
  const posterUrl = globalEvent?.poster_url ?? null;

  // Mood emoji map
  const moodEmojis: Record<string, string> = {
    epic: '\uD83D\uDD25',
    intimate: '\uD83E\uDD0D',
    euphoric: '\u26A1',
    nostalgic: '\uD83D\uDC9C',
    transcendent: '\u2728',
    rainy: '\uD83C\uDF27\uFE0F',
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Back button */}
      <Link
        href={`/${locale}/collection`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToCollection')}
      </Link>

      {/* Event image */}
      {posterUrl && (
        <div className="relative aspect-video overflow-hidden rounded-xl">
          <Image
            src={posterUrl}
            alt={eventName}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      {/* Header */}
      <div className="mt-6">
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{eventName}</h1>
          <div className="flex items-center gap-2">
            <DeleteEventButton eventId={id} eventName={eventName} />
            <Link
              href={`/${locale}/event/${id}/edit`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent"
              aria-label={t('editDetails')}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDate(eventDate, locale)}
          </span>
          {city && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {venueName ? `${venueName}, ${city}` : city}
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium capitalize">
            {event.event_type.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Rating & mood */}
      {(event.rating !== null || event.mood !== null) && (
        <div className="mt-6 flex items-center gap-6">
          {event.rating !== null && (
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-accent" />
              <span className="text-lg font-semibold">{event.rating}/5</span>
            </div>
          )}
          {event.mood !== null && (
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {moodEmojis[event.mood] ?? ''}
              </span>
              <span className="text-sm capitalize text-muted-foreground">
                {event.mood}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Historic insights from Wikipedia */}
      {globalEvent?.historic_badge_desc && (() => {
        const insights = globalEvent.historic_badge_desc.split(' | ').map(raw => {
          const trimmed = raw.trim();
          // Extract [ArtistName] prefix if present
          const artistMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)/);
          const artist = artistMatch ? artistMatch[1] : null;
          let text = artistMatch ? artistMatch[2] : trimmed;
          // Clean up fragments: capitalize first letter, trim trailing incomplete sentences
          if (text && /^[a-z]/.test(text)) {
            text = text.charAt(0).toUpperCase() + text.slice(1);
          }
          return { artist, text };
        }).filter(i => i.text.length > 15); // Skip very short fragments
        if (insights.length === 0) return null;
        return (
          <section className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              {t('historicMoments')}
              <span className="text-[10px] font-normal text-muted-foreground/60">(Wikipedia)</span>
            </h2>
            <ul className="mt-3 space-y-2.5">
              {insights.map((insight, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="mt-0.5 text-primary/60">&#8226;</span>
                  <div>
                    {insight.artist && (
                      <span className="mr-1.5 inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        {insight.artist}
                      </span>
                    )}
                    <span className="text-muted-foreground">{insight.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      {/* Memorable reason */}
      {event.is_memorable && event.memorable_reason && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{t('memorableReason') ?? 'Memorable'}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {event.memorable_reason}
          </p>
        </section>
      )}

      {/* Artists grid */}
      {artists.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Music className="h-5 w-5" />
            {t('artistsSeen')}
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
              {artists.length}
            </span>
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {artists.map((ea) => (
              <Link
                key={ea.artist_id}
                href={`/${locale}/artist/${ea.artists.id}`}
                className="flex flex-col items-center rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/10"
              >
                {ea.artists.image_url ? (
                  <Image
                    src={ea.artists.image_url}
                    alt={ea.artists.name}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Music className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <span className="mt-2 text-center text-sm font-medium">
                  {ea.artists.name}
                </span>
                {ea.personal_rating !== null && (
                  <span className="text-xs text-muted-foreground">
                    {ea.personal_rating}/5
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {event.notes && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t('notes')}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {event.notes}
          </p>
        </section>
      )}

    </div>
  );
}
