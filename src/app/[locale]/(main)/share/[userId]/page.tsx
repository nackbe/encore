import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/utils';
import { Music, Calendar, MapPin, Star } from 'lucide-react';
import type { Metadata } from 'next';
import type { UserEvent, GlobalEvent, Venue, UserEventArtist, Artist, Profile } from '@/lib/supabase/types';

type UserEventWithJoins = UserEvent & {
  global_events: (GlobalEvent & { venues: Venue | null }) | null;
  user_event_artists: Array<UserEventArtist & { artists: Artist }>;
};

interface SharePageProps {
  params: { userId: string; locale: string };
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', params.userId)
    .single() as { data: { display_name: string | null } | null };

  const name = profile?.display_name ?? 'Un fan';
  return {
    title: `${name} — Colección musical`,
    description: `Mira los conciertos y festivales que ${name} ha vivido en Encore.`,
    openGraph: {
      title: `${name} — Colección musical | Encore`,
      description: `Mira los conciertos y festivales que ${name} ha vivido.`,
    },
  };
}

export default async function SharePage({ params: { userId, locale } }: SharePageProps) {
  const t = await getTranslations('collection');
  const supabase = await createClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, city, country')
    .eq('id', userId)
    .single() as { data: Pick<Profile, 'display_name' | 'avatar_url' | 'city' | 'country'> | null };

  if (!profile) {
    notFound();
  }

  // Fetch their events
  const { data: events } = await supabase
    .from('user_events')
    .select(`
      *,
      global_events:global_event_id (
        *,
        venues:venue_id (*)
      ),
      user_event_artists (
        *,
        artists:artist_id (*)
      )
    `)
    .eq('user_id', userId)
    .order('custom_event_date', { ascending: false }) as unknown as { data: UserEventWithJoins[] | null };

  const allEvents = events ?? [];
  const uniqueArtists = new Set(allEvents.flatMap(e => e.user_event_artists?.map(a => a.artist_id) ?? []));
  const uniqueCities = new Set(allEvents.map(e => e.custom_event_city ?? e.global_events?.city).filter(Boolean));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name ?? ''}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Music className="h-8 w-8 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name ?? 'Fan'}</h1>
          {(profile.city || profile.country) && (
            <p className="text-sm text-muted-foreground">
              {[profile.city, profile.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div className="mt-6 flex gap-6 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{allEvents.length}</strong> eventos</span>
        <span><strong className="text-foreground">{uniqueArtists.size}</strong> artistas</span>
        <span><strong className="text-foreground">{uniqueCities.size}</strong> ciudades</span>
      </div>

      {/* Events grid */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {allEvents.map((event) => {
          const name = event.custom_event_name ?? event.global_events?.name ?? '';
          const date = event.custom_event_date ?? event.global_events?.date ?? '';
          const city = event.custom_event_city ?? event.global_events?.city ?? '';
          const isFestival = event.event_type === 'festival';
          const image = isFestival
            ? (event.global_events?.poster_url ?? event.user_event_artists?.[0]?.artists?.image_url ?? null)
            : (event.user_event_artists?.[0]?.artists?.image_url ?? event.global_events?.poster_url ?? null);

          return (
            <div
              key={event.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              {image ? (
                <div className="relative aspect-square">
                  <Image
                    src={image}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
              ) : (
                <div className="flex aspect-square items-center justify-center bg-muted">
                  <Music className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-3">
                <p className="truncate text-sm font-medium">{name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatEventDate(date, locale)}
                    </span>
                  )}
                </div>
                {city && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {city}
                  </span>
                )}
                {event.rating && (
                  <span className="mt-1 flex items-center gap-1 text-xs">
                    <Star className="h-3 w-3 text-accent" />
                    {event.rating}/5
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground">Hecho con Encore</p>
        <Link
          href={`/${locale}/signup`}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          Crea tu colección
        </Link>
      </div>
    </div>
  );
}
