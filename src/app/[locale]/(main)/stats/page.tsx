'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useSupabase } from '@/hooks/useSupabase';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  Music,
  Users,
  MapPin,
  Globe,
  Disc3,
  Star,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Trophy,
  Zap,
  Flag,
  Hash,
  Repeat,
} from 'lucide-react';

const ConcertMap = dynamic(
  () => import('@/components/maps/ConcertMap').then((m) => m.ConcertMap),
  { ssr: false }
);

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
}

interface Milestone {
  icon: React.ElementType;
  label: string;
  detail: string;
  date: string;
}

export default function StatsPage() {
  const t = useTranslations('stats');
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const supabase = useSupabase();

  const { data: stats, isFetching } = useQuery({
    queryKey: ['user-stats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: events } = await supabase
        .from('user_events')
        .select(
          `
          *,
          global_events:global_event_id (id, name, city, country, date, lat, lng),
          user_event_artists (
            artist_id,
            artists:artist_id (id, name, genres)
          )
        `
        )
        .eq('user_id', user!.id) as {
          data: Array<
            import('@/lib/supabase/types').UserEvent & {
              global_events: { id: string; name: string; city: string | null; country: string | null; date: string; lat: number | null; lng: number | null } | null;
              user_event_artists: Array<{
                artist_id: string;
                artists: { id: string; name: string; genres: string[] };
              }>;
            }
          > | null;
        };

      if (!events) return null;

      const totalEvents = events.length;
      const artistCounts: Record<string, { name: string; count: number }> = {};
      const genreCounts: Record<string, number> = {};
      const uniqueArtistIds = new Set<string>();
      const yearCounts: Record<number, number> = {};
      const typeCounts: Record<string, number> = {};
      const cityCounts: Record<string, number> = {};
      const countries = new Set<string>();
      let totalRating = 0;
      let ratedCount = 0;
      let festivalCount = 0;
      const mapEvents: Array<{ lat: number; lng: number; name: string; city: string; date: string }> = [];

      // For milestones — sort events chronologically
      const sorted = [...events].sort((a, b) => {
        const da = a.global_events?.date ?? a.custom_event_date ?? '';
        const db = b.global_events?.date ?? b.custom_event_date ?? '';
        return da.localeCompare(db);
      });

      // Milestone tracking
      const milestones: Milestone[] = [];
      const seenCountries = new Set<string>();
      const artistSeenCount: Record<string, number> = {};
      let firstRepeatFound = false;
      let firstFestivalFound = false;
      const milestoneThresholds = [10, 25, 50, 100, 200, 500];
      let nextThresholdIdx = 0;

      sorted.forEach((event, idx) => {
        const eventDate = event.global_events?.date ?? event.custom_event_date ?? '';
        const eventName = event.global_events?.name ?? event.custom_event_name ?? '';
        const year = eventDate ? new Date(eventDate).getFullYear() : NaN;
        if (!isNaN(year)) {
          yearCounts[year] = (yearCounts[year] ?? 0) + 1;
        }

        typeCounts[event.event_type] = (typeCounts[event.event_type] ?? 0) + 1;
        if (event.event_type === 'festival') festivalCount++;
        if (event.rating !== null) {
          totalRating += event.rating;
          ratedCount++;
        }

        const city = event.global_events?.city ?? event.custom_event_city;
        if (city) {
          cityCounts[city] = (cityCounts[city] ?? 0) + 1;
        }

        const country = event.global_events?.country;
        if (country) countries.add(country);

        const ge = event.global_events;
        if (ge?.lat != null && ge?.lng != null) {
          mapEvents.push({
            lat: ge.lat, lng: ge.lng,
            name: ge.name ?? event.custom_event_name ?? '',
            city: city ?? '',
            date: eventDate,
          });
        }

        // --- Milestones ---
        // First event
        if (idx === 0) {
          milestones.push({
            icon: Zap,
            label: 'milestoneFirstEvent',
            detail: eventName,
            date: eventDate,
          });
        }

        // First festival
        if (!firstFestivalFound && event.event_type === 'festival') {
          firstFestivalFound = true;
          milestones.push({
            icon: Disc3,
            label: 'milestoneFirstFestival',
            detail: eventName,
            date: eventDate,
          });
        }

        // First time in a new country
        if (country && !seenCountries.has(country)) {
          seenCountries.add(country);
          milestones.push({
            icon: Flag,
            label: 'milestoneFirstCountry',
            detail: country,
            date: eventDate,
          });
        }

        // Event count thresholds
        const eventNumber = idx + 1;
        if (nextThresholdIdx < milestoneThresholds.length && eventNumber === milestoneThresholds[nextThresholdIdx]) {
          milestones.push({
            icon: Hash,
            label: 'milestoneEventCount',
            detail: eventName,
            date: eventDate,
          });
          nextThresholdIdx++;
        }

        // Perfect rating
        if (event.rating === 5) {
          // Only add the first perfect rating
          if (!milestones.some((m) => m.label === 'milestonePerfectRating')) {
            milestones.push({
              icon: Star,
              label: 'milestonePerfectRating',
              detail: eventName,
              date: eventDate,
            });
          }
        }

        // First repeat artist
        event.user_event_artists?.forEach((ea) => {
          uniqueArtistIds.add(ea.artist_id);
          if (!artistCounts[ea.artist_id]) {
            artistCounts[ea.artist_id] = { name: ea.artists.name, count: 0 };
          }
          artistCounts[ea.artist_id].count++;

          artistSeenCount[ea.artist_id] = (artistSeenCount[ea.artist_id] ?? 0) + 1;
          if (!firstRepeatFound && artistSeenCount[ea.artist_id] === 2) {
            firstRepeatFound = true;
            milestones.push({
              icon: Repeat,
              label: 'milestoneFirstRepeat',
              detail: ea.artists.name,
              date: eventDate,
            });
          }

          ea.artists.genres?.forEach((genre) => {
            genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;
          });
        });
      });

      const sortedArtists = Object.entries(artistCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10);

      const sortedGenres = Object.entries(genreCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8);

      const topArtistEntry = sortedArtists[0]?.[1];
      const mostSeenArtist =
        topArtistEntry && topArtistEntry.count > 1
          ? `${topArtistEntry.name} (×${topArtistEntry.count})`
          : '-';

      const years = Object.keys(yearCounts).map(Number).sort();
      const mostActiveYear =
        years.length > 0
          ? years.reduce((a, b) =>
              (yearCounts[a] ?? 0) >= (yearCounts[b] ?? 0) ? a : b
            )
          : '-';

      const topCities = Object.entries(cityCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([city, count]) => ({ city, count }));

      return {
        totalEvents,
        uniqueArtists: uniqueArtistIds.size,
        festivals: festivalCount,
        cities: Object.keys(cityCounts).length,
        countries: countries.size,
        avgRating: ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : '-',
        mostSeenArtist,
        mostActiveYear,
        eventsByYear: years.map((y) => ({ year: y, count: yearCounts[y] ?? 0 })),
        eventsByType: Object.entries(typeCounts).map(([type, count]) => ({ type, count })),
        topArtists: sortedArtists.map(([, val]) => val),
        topGenres: sortedGenres.map(([genre, count]) => ({ genre, count })),
        topCities,
        milestones,
        mapEvents,
      };
    },
  });

  if (userLoading || isFetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    router.push(`/${locale}/login`);
    return null;
  }

  if (!stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('noDataYet')}</p>
      </div>
    );
  }

  const cards: StatCard[] = [
    { label: t('totalEvents'), value: stats.totalEvents, icon: Music },
    { label: t('uniqueArtists'), value: stats.uniqueArtists, icon: Users },
    { label: t('festivals'), value: stats.festivals, icon: Disc3 },
    { label: t('cities'), value: stats.cities, icon: MapPin },
    { label: t('countries'), value: stats.countries, icon: Globe },
    { label: t('avgRating'), value: stats.avgRating, icon: Star },
    { label: t('mostSeenArtist'), value: stats.mostSeenArtist, icon: TrendingUp },
    { label: t('mostActiveYear'), value: stats.mostActiveYear, icon: CalendarDays },
  ];

  const totalTypeEvents = stats.eventsByType.reduce((s, e) => s + e.count, 0);

  function getMilestoneLabel(m: Milestone): string {
    switch (m.label) {
      case 'milestoneFirstCountry':
        return t('milestoneFirstCountry', { country: m.detail });
      case 'milestoneEventCount':
        return t('milestoneEventCount', { count: m.detail });
      default:
        return t(m.label as Parameters<typeof t>[0]);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
          >
            <div className="flex flex-col items-center text-center">
              <card.icon className="h-5 w-5 text-primary" />
              <span className="mt-2 text-2xl font-bold">{card.value}</span>
              <span className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">

        {/* Events by year */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t('eventsByYear')}
          </h2>
          <div className="mt-5 flex items-end gap-2 px-2" style={{ height: 180 }}>
            {stats.eventsByYear.map((item) => {
              const maxCount = Math.max(...stats.eventsByYear.map((e) => e.count), 1);
              const pct = (item.count / maxCount) * 100;
              const barHeight = Math.max(pct, 10);
              return (
                <div key={item.year} className="flex flex-1 flex-col items-center">
                  <span className="mb-1.5 text-xs font-semibold text-foreground">{item.count}</span>
                  <div
                    className="w-full max-w-[48px] rounded-t-md bg-primary/70 transition-all duration-500"
                    style={{ height: `${barHeight}px`, minHeight: 16, maxHeight: 140 }}
                  />
                  <span className="mt-1.5 text-[11px] font-medium text-muted-foreground">{item.year}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Events by type */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Disc3 className="h-5 w-5 text-secondary" />
            {t('eventsByType')}
          </h2>
          <div className="mt-5 flex h-8 overflow-hidden rounded-lg bg-muted">
            {stats.eventsByType.map((item, i) => {
              const pct = totalTypeEvents > 0 ? (item.count / totalTypeEvents) * 100 : 0;
              const isCopper = i % 2 === 0;
              return (
                <div
                  key={item.type}
                  className="relative flex items-center justify-center transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isCopper
                      ? 'rgb(212 132 90 / 0.7)'
                      : 'rgb(91 163 167 / 0.7)',
                  }}
                  title={`${item.type}: ${item.count}`}
                >
                  {pct > 18 && (
                    <span className="text-[10px] font-bold text-white/90 truncate px-1">
                      {item.count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {stats.eventsByType.map((item, i) => {
              const isCopper = i % 2 === 0;
              return (
                <div key={item.type} className="flex items-center gap-1.5">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{
                      backgroundColor: isCopper
                        ? 'rgb(212 132 90 / 0.7)'
                        : 'rgb(91 163 167 / 0.7)',
                    }}
                  />
                  <span className="text-xs capitalize text-muted-foreground">
                    {item.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-semibold">{item.count}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top Artists */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Music className="h-5 w-5 text-primary" />
            {t('topArtists')}
          </h2>
          <div className="mt-5 space-y-2">
            {stats.topArtists.map((artist, i) => {
              const maxCount = Math.max(...stats.topArtists.map((a) => a.count), 1);
              const pct = (artist.count / maxCount) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="w-28 truncate text-sm font-medium">
                    {artist.name}
                  </span>
                  <div className="relative flex-1 h-5 rounded-md bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-md bg-primary/50 transition-all duration-500"
                      style={{ width: `${Math.max(pct, 6)}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-sm font-bold text-primary">
                    {artist.count}
                  </span>
                </div>
              );
            })}
            {stats.topArtists.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">-</p>
            )}
          </div>
        </section>

        {/* Top Genres — pills */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Star className="h-5 w-5 text-secondary" />
            {t('topGenres')}
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {stats.topGenres.map((genre, i) => {
              const maxCount = Math.max(...stats.topGenres.map((g) => g.count), 1);
              const intensity = 0.15 + (genre.count / maxCount) * 0.55;
              const isCopper = i % 2 === 0;
              return (
                <div
                  key={genre.genre}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5"
                  style={{
                    borderColor: isCopper
                      ? `rgb(212 132 90 / ${intensity})`
                      : `rgb(91 163 167 / ${intensity})`,
                    backgroundColor: isCopper
                      ? `rgb(212 132 90 / ${intensity * 0.2})`
                      : `rgb(91 163 167 / ${intensity * 0.2})`,
                  }}
                >
                  <span
                    className="text-sm font-medium capitalize"
                    style={{ color: isCopper ? '#D4845A' : '#5BA3A7' }}
                  >
                    {genre.genre}
                  </span>
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-bold">
                    {genre.count}
                  </span>
                </div>
              );
            })}
            {stats.topGenres.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground w-full">-</p>
            )}
          </div>
        </section>

        {/* Milestones */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="h-5 w-5 text-primary" />
            {t('milestones')}
          </h2>
          <div className="mt-5">
            {stats.milestones.length > 0 ? (
              <div className="relative space-y-0">
                {/* Vertical line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                {stats.milestones.map((m, i) => {
                  const Icon = m.icon;
                  const dateStr = m.date
                    ? new Date(m.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
                    : '';
                  return (
                    <div key={i} className="relative flex items-start gap-3 py-2.5">
                      <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-card border border-border">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm font-medium leading-tight">
                          {getMilestoneLabel(m)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {m.detail}
                          {dateStr && (
                            <span className="ml-1.5 text-muted-foreground/60">
                              · {dateStr}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('milestonesEmpty')}
              </p>
            )}
          </div>
        </section>

        {/* Top Cities */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-secondary" />
            {t('topCities')}
          </h2>
          <div className="mt-5 space-y-2">
            {stats.topCities.length > 0 ? (
              stats.topCities.map((item, i) => {
                const maxCount = Math.max(...stats.topCities.map((c) => c.count), 1);
                const pct = (item.count / maxCount) * 100;
                return (
                  <div key={item.city} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-secondary/15 text-xs font-bold text-secondary">
                      {i + 1}
                    </span>
                    <span className="w-28 truncate text-sm font-medium">
                      {item.city}
                    </span>
                    <div className="relative flex-1 h-5 rounded-md bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-secondary/50 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 6)}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm font-bold text-secondary">
                      {item.count}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('topCitiesEmpty')}
              </p>
            )}
          </div>
        </section>

        {/* Concert map */}
        <section className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5 text-secondary" />
            {t('concertMap')}
          </h2>
          <div className="mt-4">
            {stats.mapEvents.length > 0 ? (
              <ConcertMap events={stats.mapEvents} className="h-80 rounded-lg" eventsLabel={t('mapEventsLabel')} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  {t('mapComingSoon')}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
