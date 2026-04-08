import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { ArtistFollowButton } from '@/components/artists/ArtistFollowButton';
import type { Artist, Venue } from '@/lib/supabase/types';
import {
  Music,
  Calendar,
  MapPin,
  TrendingUp,
  Award,
  Star,
} from 'lucide-react';

interface ArtistPageProps {
  params: { id: string; locale: string };
}

export default async function ArtistPage({
  params: { id, locale },
}: ArtistPageProps) {
  const t = await getTranslations('artist');
  const supabase = await createClient();

  // Fetch artist
  const { data: artistData } = await supabase
    .from('artists')
    .select('*')
    .eq('id', id)
    .single() as { data: Artist | null };

  if (!artistData) {
    notFound();
  }

  const artist = artistData;

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch user's events with this artist
  let userShows: Array<{
    id: string;
    custom_event_name: string | null;
    custom_event_date: string | null;
    custom_event_city: string | null;
    rating: number | null;
    global_events: { name: string; date: string; venues: { name: string; city: string } | null } | null;
  }> = [];

  let isFollowing = false;

  if (user) {
    const { data: eventArtists } = await supabase
      .from('user_event_artists')
      .select(
        `
        user_events:user_event_id (
          id,
          custom_event_name,
          custom_event_date,
          custom_event_city,
          rating,
          global_events:global_event_id (name, date, venues:venue_id (name, city))
        )
      `
      )
      .eq('artist_id', id) as { data: Array<{ user_events: (typeof userShows)[number] | null }> | null };

    userShows =
      (eventArtists
        ?.map((ea) => ea.user_events)
        .filter(Boolean) as typeof userShows) ?? [];

    userShows.sort(
      (a, b) =>
        new Date(a.custom_event_date ?? a.global_events?.date ?? '').getTime() -
        new Date(b.custom_event_date ?? b.global_events?.date ?? '').getTime()
    );

    // Check follow status
    const { data: follow } = await supabase
      .from('user_followed_artists')
      .select('id')
      .eq('user_id', user.id)
      .eq('artist_id', id)
      .maybeSingle() as { data: { id: string } | null };

    isFollowing = !!follow;
  }

  const timesSeen = userShows.length;
  const firstShow = userShows.length > 0 ? userShows[0] : null;

  // "Lo vi primero" badge: user saw them before they became popular (spotify_popularity > 70)
  const firstShowDate = firstShow
    ? (firstShow.custom_event_date ?? firstShow.global_events?.date ?? null)
    : null;
  const sawBeforeFame =
    artist.spotify_popularity !== null &&
    artist.spotify_popularity > 70 &&
    firstShowDate !== null &&
    new Date(firstShowDate) < new Date('2020-01-01');

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Artist header */}
      <div className="flex flex-col items-center sm:flex-row sm:items-start sm:gap-8">
        {artist.image_url ? (
          <img
            src={artist.image_url}
            alt={artist.name}
            className="h-40 w-40 rounded-full object-cover shadow-lg"
          />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-muted">
            <Music className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        <div className="mt-4 flex-1 text-center sm:mt-0 sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight">{artist.name}</h1>

          {/* Genres */}
          {artist.genres?.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              {artist.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs capitalize text-muted-foreground"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="mt-4 flex flex-wrap justify-center gap-6 sm:justify-start">
            {timesSeen > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="h-4 w-4 text-primary" />
                <span className="font-semibold">{timesSeen}</span>
                <span className="text-muted-foreground">
                  {t('timesSeen', { count: timesSeen })}
                </span>
              </div>
            )}
            {artist.spotify_popularity !== null && (
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span className="font-semibold">{artist.spotify_popularity}</span>
                <span className="text-muted-foreground">
                  {t('spotifyPopularity')}
                </span>
              </div>
            )}
          </div>

          {/* Badges */}
          {sawBeforeFame && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">
                <Award className="h-3 w-3" />
                {t('sawThemFirst')}
              </span>
            </div>
          )}

          {/* Follow button */}
          {user && (
            <div className="mt-4">
              <ArtistFollowButton
                artistId={id}
                initialFollowing={isFollowing}
              />
            </div>
          )}
        </div>
      </div>

      {/* First time seen */}
      {firstShow && (
        <section className="mt-8 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('firstTimeSeen')}
          </h2>
          <p className="mt-1 font-semibold">
            {formatDate(firstShow.custom_event_date ?? firstShow.global_events?.date ?? '', locale)}
          </p>
          <p className="text-sm text-muted-foreground">
            {firstShow.global_events?.venues?.name ?? ''}{' '}
            {firstShow.custom_event_city ??
              firstShow.global_events?.venues?.city ??
              ''}
          </p>
        </section>
      )}

      {/* Timeline */}
      {userShows.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t('showTimeline')}</h2>
          <div className="mt-4 space-y-4">
            {userShows.map((show) => {
              const showCity =
                show.custom_event_city ??
                show.global_events?.venues?.city ??
                '';
              const showVenue =
                show.global_events?.venues?.name ??
                '';
              const showDate = show.custom_event_date ?? show.global_events?.date ?? '';
              const showName = show.custom_event_name ?? show.global_events?.name ?? '';

              return (
                <a
                  key={show.id}
                  href={`/${locale}/event/${show.id}`}
                  className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/10"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{showName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(showDate, locale)}
                    </p>
                    {(showVenue || showCity) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {showVenue ? `${showVenue}, ${showCity}` : showCity}
                      </p>
                    )}
                  </div>
                  {show.rating !== null && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 text-accent" />
                      {show.rating}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
