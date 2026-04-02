import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import type { GlobalEvent, Venue, GlobalEventArtist, Artist } from '@/lib/supabase/types';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Music,
  Users,
} from 'lucide-react';
import { WishlistButton } from '@/components/events/WishlistButton';

type GlobalEventWithJoins = GlobalEvent & {
  venues: Venue | null;
  global_event_artists: Array<GlobalEventArtist & { artists: Artist }>;
};

interface GlobalEventPageProps {
  params: { id: string; locale: string };
}

export default async function GlobalEventPage({
  params: { id, locale },
}: GlobalEventPageProps) {
  const t = await getTranslations('event');
  const tTypes = await getTranslations('eventTypes');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('global_events')
    .select(
      `
      id, name, date, date_end, city, country, event_type, poster_url,
      ticket_price_min, ticket_price_max, currency, is_past,
      venues:venue_id (id, name, city, country, capacity),
      global_event_artists (
        role, billing_order, stage,
        artists:artist_id (id, name, image_url)
      )
    `
    )
    .eq('id', id)
    .single() as { data: GlobalEventWithJoins | null };

  if (!event) {
    notFound();
  }

  const venue = event.venues;
  const artists = event.global_event_artists ?? [];
  const city = event.city ?? venue?.city ?? '';
  const country = event.country ?? venue?.country ?? '';
  const isPast = new Date(event.date) < new Date();

  // Check if user has wishlisted this event
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let isWishlisted = false;
  if (authUser) {
    const { data: wish } = await supabase
      .from('user_wishlist')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('global_event_id', id)
      .maybeSingle() as { data: { id: string } | null };
    isWishlisted = !!wish;
  }

  // Sort artists by billing order
  const sortedArtists = [...artists].sort(
    (a, b) => (a.billing_order ?? 99) - (b.billing_order ?? 99)
  );

  const headliners = sortedArtists.filter((a) => a.role === 'headliner');
  const supports = sortedArtists.filter((a) => a.role !== 'headliner');

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Back button */}
      <Link
        href={`/${locale}/discover`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToDiscover')}
      </Link>

      {/* Poster */}
      {event.poster_url && (
        <div className="relative aspect-video overflow-hidden rounded-xl">
          <Image
            src={event.poster_url}
            alt={event.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      {/* Header */}
      <div className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
            <span className="mt-1 inline-block rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {tTypes(event.event_type)}
            </span>
          </div>
          <WishlistButton
            globalEventId={id}
            initialWishlisted={isWishlisted}
          />
        </div>

        {/* Meta */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            {formatDate(event.date, locale)}
            {event.date_end && ` — ${formatDate(event.date_end, locale)}`}
          </span>
          {(city || venue) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {venue?.name ? `${venue.name}, ${city}` : city}
              {country && `, ${country}`}
            </span>
          )}
          {venue?.capacity && (
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              {venue.capacity.toLocaleString()} cap.
            </span>
          )}
        </div>

        {/* Action button — only "Estuve ahí" for past events */}
        {isPast && (
          <div className="mt-6">
            <Link
              href={`/${locale}/register?eventId=${id}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/85"
            >
              <Music className="h-4 w-4" />
              {t('iWasThere')}
            </Link>
          </div>
        )}
      </div>

      {/* Price info */}
      {(event.ticket_price_min || event.ticket_price_max) && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('price')}</span>
            <span className="font-semibold">
              {event.ticket_price_min && event.ticket_price_max
                ? `${event.currency ?? '$'}${event.ticket_price_min} — ${event.currency ?? '$'}${event.ticket_price_max}`
                : `${event.currency ?? '$'}${event.ticket_price_min ?? event.ticket_price_max}`}
            </span>
          </div>
        </div>
      )}

      {/* Artists */}
      {sortedArtists.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Music className="h-5 w-5" />
            {t('artists')}
          </h2>

          {/* Headliners */}
          {headliners.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {headliners.map((ea) => (
                <div
                  key={ea.artist_id}
                  className="flex flex-col items-center rounded-xl border border-border bg-card p-4"
                >
                  {ea.artists.image_url ? (
                    <Image
                      src={ea.artists.image_url}
                      alt={ea.artists.name}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                      <Music className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <span className="mt-3 text-center text-sm font-semibold">
                    {ea.artists.name}
                  </span>
                  {ea.stage && (
                    <span className="mt-0.5 text-[11px] text-muted-foreground">
                      {ea.stage}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Support / other artists */}
          {supports.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {supports.map((ea) => (
                <span
                  key={ea.artist_id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm"
                >
                  <Music className="h-3 w-3 text-muted-foreground" />
                  {ea.artists.name}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Venue details */}
      {venue && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5" />
            {t('venue')}
          </h2>
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <p className="font-medium">{venue.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[venue.city, venue.country].filter(Boolean).join(', ')}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
