'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Calendar, MapPin, Music, Bookmark } from 'lucide-react';
import { WishlistButton } from '@/components/events/WishlistButton';
import type { GlobalEvent, Venue, GlobalEventArtist, Artist } from '@/lib/supabase/types';

type WishlistEventWithJoins = {
  id: string;
  global_event_id: string;
  created_at: string;
  global_events: GlobalEvent & {
    venues: Venue | null;
    global_event_artists: Array<GlobalEventArtist & { artists: Artist }>;
  };
};

interface WishlistGridProps {
  initialEvents: WishlistEventWithJoins[];
}

export function WishlistGrid({ initialEvents }: WishlistGridProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('collection');
  const tDiscover = useTranslations('discover');

  if (initialEvents.length === 0) {
    return (
      <div className="py-16 text-center">
        <Bookmark className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="mt-4 text-lg font-medium text-muted-foreground">
          {t('wishlistEmpty')}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('wishlistEmptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {initialEvents.map((wish) => {
        const event = wish.global_events;
        if (!event) return null;

        const venue = event.venues;
        const city = event.city ?? venue?.city ?? '';
        const artists = event.global_event_artists ?? [];
        const headliner = artists.find((a) => a.role === 'headliner');
        const isPast = new Date(event.date) < new Date();

        return (
          <div
            key={wish.id}
            className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30"
            onClick={() => router.push(`/${locale}/discover/${event.id}`)}
          >
            {/* Image */}
            <div className="relative aspect-[3/2] overflow-hidden bg-encore-navy">
              {event.poster_url ? (
                <Image
                  src={event.poster_url}
                  alt={event.name}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : headliner?.artists.image_url ? (
                <Image
                  src={headliner.artists.image_url}
                  alt={event.name}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl text-white/10">
                  <Music className="h-12 w-12" />
                </div>
              )}

              {/* Wishlist button overlay */}
              <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
                <WishlistButton
                  globalEventId={event.id}
                  initialWishlisted={true}
                  variant="overlay"
                />
              </div>

              {/* Past badge */}
              {isPast && (
                <div className="absolute left-2 top-2">
                  <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                    {tDiscover('pastBadge')}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="truncate text-sm font-semibold">{event.name}</h3>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(event.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                {city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {city}
                  </span>
                )}
              </div>
              {/* Artists preview */}
              {artists.length > 0 && (
                <p className="mt-1.5 truncate text-xs text-muted-foreground">
                  {artists
                    .slice(0, 3)
                    .map((a) => a.artists.name)
                    .join(', ')}
                  {artists.length > 3 && ` +${artists.length - 3}`}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
