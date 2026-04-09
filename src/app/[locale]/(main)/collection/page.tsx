import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { CollectionGrid } from '@/components/collection/CollectionGrid';
import { CollectionInsights } from '@/components/collection/CollectionInsights';
import { PlusCircle } from 'lucide-react';
import type { UserEvent, Venue, Artist, UserEventArtist, GlobalEvent } from '@/lib/supabase/types';

type UserEventWithJoins = UserEvent & {
  global_events: (GlobalEvent & { venues: Venue | null }) | null;
  user_event_artists: Array<UserEventArtist & { artists: Artist }>;
};

export default async function CollectionPage() {
  const t = await getTranslations('collection');
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('title')}
        </h1>
        <Link
          href={`/${locale}/register`}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-95"
        >
          <PlusCircle className="h-4 w-4" />
          {t('registerCta')}
        </Link>
      </div>

      {/* Insights: artist cloud, genres, badges */}
      <CollectionInsights events={events} />

      {/* Events grid with filters */}
      <div className="mt-6">
        <CollectionGrid initialEvents={events} />
      </div>
    </div>
  );
}
