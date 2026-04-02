import { redirect } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { CollectionGrid } from '@/components/collection/CollectionGrid';
import { Music, Users } from 'lucide-react';
import type { UserEvent, Venue, Artist, UserEventArtist, GlobalEvent } from '@/lib/supabase/types';

type UserEventWithJoins = UserEvent & {
  global_events: (GlobalEvent & { venues: Venue | null }) | null;
  user_event_artists: Array<UserEventArtist & { artists: Artist }>;
};

export default async function CollectionPage() {
  const t = await getTranslations('collection');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  const { data: userEvents } = await supabase
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
    .eq('user_id', user.id)
    .order('custom_event_date', { ascending: false }) as unknown as { data: UserEventWithJoins[] | null };

  const events = userEvents ?? [];

  const uniqueArtistIds = new Set<string>();
  events.forEach((event) => {
    event.user_event_artists?.forEach((ea) => uniqueArtistIds.add(ea.artist_id));
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header with inline summary */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('title')}
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Music className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{events.length}</span>
            {t('eventsCount')}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-secondary" />
            <span className="font-semibold text-foreground">{uniqueArtistIds.size}</span>
            {t('artistsCount')}
          </span>
        </div>
      </div>

      {/* Events grid with filters */}
      <div className="mt-6">
        <CollectionGrid initialEvents={events} />
      </div>
    </div>
  );
}
