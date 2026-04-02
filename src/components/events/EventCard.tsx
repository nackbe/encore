'use client';

import * as React from 'react';
import Image from 'next/image';
import { Star, Eye } from 'lucide-react';
import { useLocale } from 'next-intl';

import { cn, getEventTypeColor, formatEventDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EventType, BadgeType } from '@/types';

interface EventArtist {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface EventCardData {
  id: string;
  name: string;
  date: string;
  city: string;
  eventType: EventType;
  imageUrl: string | null;
  rating: number | null;
  isMemorable: boolean;
  historicBadges: Array<{ badgeType: BadgeType; label: string }>;
  viewCount: number;
  artists: EventArtist[];
}

interface EventCardProps {
  event: EventCardData;
  variant?: 'grid' | 'list';
  showBadges?: boolean;
  onClick?: () => void;
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < rating
              ? 'fill-secondary text-secondary'
              : 'fill-none text-white/30'
          )}
        />
      ))}
    </div>
  );
}

function EventTypeBadge({ type }: { type: EventType }) {
  const colorClass = getEventTypeColor(type);
  const labels: Record<EventType, string> = {
    concert: 'Concert',
    festival: 'Festival',
    club_show: 'Club',
    theater: 'Theater',
    special: 'Special',
  };

  return (
    <Badge variant="outline" className={cn('text-xs', colorClass)}>
      {labels[type]}
    </Badge>
  );
}

export function EventCard({
  event,
  variant = 'grid',
  showBadges = true,
  onClick,
}: EventCardProps) {
  const locale = useLocale();
  const hasGoldBorder = event.isMemorable || event.historicBadges.length > 0;
  const formattedDate = formatEventDate(event.date, locale);

  const primaryArtist = event.artists[0];
  const fallbackImage = primaryArtist?.imageUrl ?? null;
  const displayImage = event.imageUrl ?? fallbackImage;

  if (variant === 'list') {
    return (
      <Card
        className={cn(
          'cursor-pointer transition-shadow hover:shadow-md',
          hasGoldBorder && 'border-secondary border-2'
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Thumbnail */}
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-encore-navy">
            {displayImage ? (
              <Image
                src={displayImage}
                alt={event.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-white/30">
                &#9835;
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="truncate font-semibold">{event.name}</h3>
            <p className="text-sm text-muted-foreground">
              {formattedDate} &middot; {event.city}
            </p>
          </div>

          {/* Right side */}
          <div className="flex flex-col items-end gap-1">
            <EventTypeBadge type={event.eventType} />
            {event.rating !== null && <RatingStars rating={event.rating} />}
          </div>
        </div>
      </Card>
    );
  }

  // Grid variant
  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg',
        hasGoldBorder && 'border-secondary border-2'
      )}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-encore-navy">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={event.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl text-white/20">
            &#9835;
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <EventTypeBadge type={event.eventType} />
        </div>

        {/* View count badge */}
        {event.viewCount > 0 && (
          <div className="absolute right-2 top-2">
            <Badge
              variant="secondary"
              className="gap-1 bg-black/60 text-white text-xs"
            >
              <Eye className="h-3 w-3" />
              {event.viewCount}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-3">
        <h3 className="truncate font-semibold leading-tight">{event.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {formattedDate} &middot; {event.city}
        </p>

        <div className="mt-2 flex items-center justify-between">
          {event.rating !== null ? (
            <RatingStars rating={event.rating} />
          ) : (
            <span />
          )}

          {/* Historic badges */}
          {showBadges && event.historicBadges.length > 0 && (
            <div className="flex gap-1">
              {event.historicBadges.map((badge) => (
                <Badge
                  key={badge.badgeType}
                  variant="gold"
                  className="text-[10px]"
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
