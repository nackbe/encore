'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Trophy, Mic2, Guitar, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import type { UserEvent, Venue, Artist, UserEventArtist, GlobalEvent } from '@/lib/supabase/types';

type UserEventWithJoins = UserEvent & {
  global_events: (GlobalEvent & { venues: Venue | null }) | null;
  user_event_artists: Array<UserEventArtist & { artists: Artist }>;
};

interface CollectionInsightsProps {
  events: UserEventWithJoins[];
}

// ─── Artist frequency ────────────────────────────────────────
function useArtistCloud(events: UserEventWithJoins[]) {
  return React.useMemo(() => {
    const counts = new Map<string, { artist: Artist; count: number }>();
    events.forEach((e) => {
      e.user_event_artists?.forEach((ea) => {
        const existing = counts.get(ea.artist_id);
        if (existing) {
          existing.count++;
        } else {
          counts.set(ea.artist_id, { artist: ea.artists, count: 1 });
        }
      });
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [events]);
}

// ─── Genre frequency ─────────────────────────────────────────
function useGenreBubbles(events: UserEventWithJoins[]) {
  return React.useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((e) => {
      e.user_event_artists?.forEach((ea) => {
        (ea.artists.genres as string[] | null)?.forEach((g) => {
          counts.set(g, (counts.get(g) ?? 0) + 1);
        });
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([genre, count]) => ({ genre, count }));
  }, [events]);
}

// ─── Badges / achievements ───────────────────────────────────
interface Badge {
  icon: 'trophy' | 'mic' | 'guitar';
  title: string;
  description: string;
}

function useBadges(events: UserEventWithJoins[], t: (key: string, values?: Record<string, string | number>) => string): Badge[] {
  return React.useMemo(() => {
    const badges: Badge[] = [];
    const total = events.length;
    if (total === 0) return badges;

    // Event count milestones
    const milestones = [5, 10, 25, 50, 100, 200, 500];
    const reached = milestones.filter((m) => total >= m);
    if (reached.length > 0) {
      const top = reached[reached.length - 1];
      badges.push({
        icon: 'trophy',
        title: t('badgeMilestone', { count: top }),
        description: t('badgeMilestoneDesc', { count: top }),
      });
    }

    // Unique artists
    const artistIds = new Set<string>();
    events.forEach((e) => e.user_event_artists?.forEach((ea) => artistIds.add(ea.artist_id)));
    const artistMilestones = [10, 25, 50, 100, 250, 500];
    const artistReached = artistMilestones.filter((m) => artistIds.size >= m);
    if (artistReached.length > 0) {
      const top = artistReached[artistReached.length - 1];
      badges.push({
        icon: 'mic',
        title: t('badgeArtists', { count: top }),
        description: t('badgeArtistsDesc', { count: top }),
      });
    }

    // Repeat artists (seen 3+ times)
    const artistCounts = new Map<string, number>();
    events.forEach((e) => {
      e.user_event_artists?.forEach((ea) => {
        artistCounts.set(ea.artist_id, (artistCounts.get(ea.artist_id) ?? 0) + 1);
      });
    });
    const superfans = Array.from(artistCounts.values()).filter((c) => c >= 3).length;
    if (superfans > 0) {
      badges.push({
        icon: 'guitar',
        title: t('badgeSuperfan', { count: superfans }),
        description: t('badgeSuperfanDesc'),
      });
    }

    // Countries explorer
    const countries = new Set<string>();
    events.forEach((e) => {
      const country = e.global_events?.country;
      if (country) countries.add(country);
    });
    if (countries.size >= 3) {
      badges.push({
        icon: 'trophy',
        title: t('badgeExplorer', { count: countries.size }),
        description: t('badgeExplorerDesc'),
      });
    }

    // Festival lover
    const festivals = events.filter((e) => e.event_type === 'festival').length;
    if (festivals >= 3) {
      badges.push({
        icon: 'mic',
        title: t('badgeFestivalLover', { count: festivals }),
        description: t('badgeFestivalLoverDesc'),
      });
    }

    return badges;
  }, [events, t]);
}

// ─── Badge icon mapper ───────────────────────────────────────
function BadgeIcon({ icon }: { icon: Badge['icon'] }) {
  switch (icon) {
    case 'trophy':
      return <Trophy className="h-4 w-4" />;
    case 'mic':
      return <Mic2 className="h-4 w-4" />;
    case 'guitar':
      return <Guitar className="h-4 w-4" />;
  }
}

// ─── Main component ──────────────────────────────────────────
export function CollectionInsights({ events }: CollectionInsightsProps) {
  const t = useTranslations('collection');
  const [expanded, setExpanded] = React.useState(true);
  const artists = useArtistCloud(events);
  const genres = useGenreBubbles(events);
  const badges = useBadges(events, t);

  if (events.length < 3) return null;

  const maxGenreCount = Math.max(...genres.map((g) => g.count), 1);
  const maxArtistCount = Math.max(...artists.map((a) => a.count), 1);

  return (
    <div className="mt-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {t('insightsTitle')}
      </button>

      {expanded && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Artist Cloud */}
          {artists.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('topArtists')}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {artists.map(({ artist, count }) => {
                  const ratio = count / maxArtistCount;
                  const size = ratio > 0.7 ? 'text-sm font-bold' : ratio > 0.4 ? 'text-xs font-semibold' : 'text-[11px] font-medium';
                  const opacity = 0.5 + ratio * 0.5;
                  return (
                    <span
                      key={artist.id}
                      className={`inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 ${size}`}
                      style={{ opacity }}
                      title={`${artist.name} — ${count}x`}
                    >
                      {artist.image_url && (
                        <Image
                          src={artist.image_url}
                          alt=""
                          width={16}
                          height={16}
                          className="h-4 w-4 rounded-full object-cover"
                        />
                      )}
                      {artist.name}
                      {count > 1 && (
                        <span className="text-[10px] text-muted-foreground">{count}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Genre Bubbles */}
          {genres.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('topGenresTitle')}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {genres.map(({ genre, count }, i) => {
                  const intensity = 0.15 + (count / maxGenreCount) * 0.55;
                  const isCopper = i % 2 === 0;
                  const r = isCopper ? '212, 132, 90' : '91, 163, 167';
                  return (
                    <span
                      key={genre}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                      style={{
                        borderColor: `rgb(${r} / ${intensity})`,
                        backgroundColor: `rgb(${r} / ${intensity * 0.2})`,
                        color: isCopper ? '#D4845A' : '#5BA3A7',
                      }}
                    >
                      {genre}
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-muted/50 px-1 text-[10px] font-bold text-foreground">
                        {count}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('badgesTitle')}
              </h3>
              <div className="flex flex-col gap-2">
                {badges.map((badge, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-transparent p-2"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <BadgeIcon icon={badge.icon} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight">{badge.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
