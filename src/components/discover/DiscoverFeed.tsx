'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import {
  Calendar,
  MapPin,
  Music,
  Bookmark,
  SlidersHorizontal,
  ArrowUpDown,
  Search,
  X,
  LayoutGrid,
  List,
  Clock,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WishlistButton } from '@/components/events/WishlistButton';
import { LocationSelector, type LocationFilter } from './LocationSelector';
import type { GlobalEvent, Venue, GlobalEventArtist, Artist } from '@/lib/supabase/types';

type GlobalEventWithJoins = GlobalEvent & {
  venues: Venue | null;
  global_event_artists: Array<GlobalEventArtist & { artists: Artist }>;
};

interface DiscoverFeedProps {
  userCity: string;
  userCountry: string;
  userGenres: string[];
  wishlistedIds: string[];
  availableCities: string[];
  availableCountries: string[];
}

type TabType = 'all' | 'saved';
type SortType = 'date_asc' | 'date_desc' | 'name';
type ViewMode = 'grid' | 'list' | 'timeline';

export function DiscoverFeed({
  userCity,
  userCountry,
  userGenres,
  wishlistedIds: initialWishlistedIds,
  availableCities,
  availableCountries,
}: DiscoverFeedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('discover');
  const tTypes = useTranslations('eventTypes');
  const supabase = useSupabase();
  const { user } = useUser();

  const initialTab = (searchParams.get('tab') === 'saved' ? 'saved' : 'all') as TabType;

  // ── Core state ──
  const [events, setEvents] = useState<GlobalEventWithJoins[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Filters ──
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    city: userCity,
    country: userCountry,
    label: userCity ? `${userCity}, ${userCountry}` : '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [resetLocationKey, setResetLocationKey] = useState(0);
  const [sortBy, setSortBy] = useState<SortType>('date_asc');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // ── Wishlist ──
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(
    () => new Set(initialWishlistedIds)
  );

  // Debounce search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Sync wishlist from DB
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function syncWishlist() {
      const { data } = await supabase
        .from('user_wishlist')
        .select('global_event_id')
        .eq('user_id', user!.id) as { data: Array<{ global_event_id: string }> | null };

      if (!cancelled && data) {
        setWishlistedIds(new Set(data.map((w) => w.global_event_id)));
      }
    }

    syncWishlist();
    return () => { cancelled = true; };
  }, [user, supabase]);

  // ── Fetch events from API ──
  const fetchEvents = useCallback(async (pageNum: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));

      // Exact mode: always use city/country text filter, never proximity
      // Proximity mode: use lat/lng if available, otherwise city/country for forward-geocode
      if (locationFilter.exactMatch) {
        if (locationFilter.city) params.set('city', locationFilter.city);
        if (locationFilter.country) params.set('country', locationFilter.country);
        params.set('exact', '1');
      } else if (locationFilter.lat != null && locationFilter.lng != null) {
        params.set('lat', String(locationFilter.lat));
        params.set('lng', String(locationFilter.lng));
      } else if (locationFilter.city) {
        params.set('city', locationFilter.city);
      } else if (locationFilter.country) {
        params.set('country', locationFilter.country);
      }
      if (selectedType) params.set('eventType', selectedType);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('sort', sortBy);

      const res = await fetch(`/api/discover?${params.toString()}`);
      const data = await res.json();

      if (append) {
        setEvents((prev) => [...prev, ...(data.events ?? [])]);
      } else {
        setEvents(data.events ?? []);
      }
      setTotal(data.total ?? 0);
      setPage(pageNum);
      setHasMore(data.hasMore ?? false);
    } catch (err) {
      console.error('Failed to fetch discover events:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [locationFilter, selectedType, debouncedSearch, sortBy]);

  // Fetch on filter change (reset to page 1)
  useEffect(() => {
    fetchEvents(1, false);
  }, [fetchEvents]);

  function handleLoadMore() {
    if (!loadingMore && hasMore) {
      fetchEvents(page + 1, true);
    }
  }

  // ── Tab change ──
  function handleTabChange(tab: TabType) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'saved') {
      params.set('tab', 'saved');
    } else {
      params.delete('tab');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // ── Location change ──
  function handleLocationChange(location: LocationFilter) {
    setLocationFilter(location);
  }

  // ── Genre pills (personalized top 5) ──
  const discoverGenreCounts = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((e) => {
      e.global_event_artists?.forEach((ea) => {
        (ea.artists.genres as string[] | null)?.forEach((g) => {
          counts.set(g, (counts.get(g) ?? 0) + 1);
        });
      });
    });
    return counts;
  }, [events]);

  const { topGenres, extraGenres } = useMemo(() => {
    const allAvailable = Array.from(discoverGenreCounts.keys());
    const userPool = new Set(userGenres);

    const userRelevant = allAvailable
      .filter((g) => userPool.has(g))
      .sort((a, b) => (discoverGenreCounts.get(b) ?? 0) - (discoverGenreCounts.get(a) ?? 0));

    const top = userRelevant.slice(0, 5);

    if (top.length < 5) {
      const topSet = new Set(top);
      const byFrequency = allAvailable
        .filter((g) => !topSet.has(g))
        .sort((a, b) => (discoverGenreCounts.get(b) ?? 0) - (discoverGenreCounts.get(a) ?? 0));
      for (const g of byFrequency) {
        if (top.length >= 5) break;
        top.push(g);
      }
    }

    const topSet = new Set(top);
    const extra = allAvailable.filter((g) => !topSet.has(g)).sort();
    return { topGenres: top, extraGenres: extra };
  }, [discoverGenreCounts, userGenres]);

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }

  // ── Wishlist toggle ──
  const handleWishlistToggle = useCallback((eventId: string, wishlisted: boolean) => {
    setWishlistedIds((prev) => {
      const next = new Set(prev);
      if (wishlisted) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  }, []);

  // ── Client-side filtering (genres + saved tab) ──
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    if (activeTab === 'saved') {
      filtered = filtered.filter((e) => wishlistedIds.has(e.id));
    }

    if (selectedGenres.size > 0) {
      filtered = filtered.filter((e) =>
        e.global_event_artists?.some((ea) =>
          (ea.artists.genres as string[] | null)?.some((g) => selectedGenres.has(g))
        )
      );
    }

    return filtered;
  }, [events, activeTab, selectedGenres, wishlistedIds]);

  // ── Timeline grouping ──
  const groupedByMonth = useMemo(() => {
    const groups: { label: string; events: GlobalEventWithJoins[] }[] = [];
    let currentLabel = '';

    filteredEvents.forEach((event) => {
      if (!event.date) return;
      const d = new Date(event.date);
      const label = d.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, events: [] });
      }
      groups[groups.length - 1].events.push(event);
    });

    return groups;
  }, [filteredEvents, locale]);

  // ── Event types from loaded data ──
  const eventTypes = useMemo(() => {
    const typeSet = new Set<string>();
    events.forEach((e) => {
      if (e.event_type) typeSet.add(e.event_type);
    });
    return Array.from(typeSet).sort();
  }, [events]);

  const locationChanged = locationFilter.city !== userCity || locationFilter.country !== userCountry;
  const hasActiveFilters = debouncedSearch || selectedType || selectedGenres.size > 0 || locationChanged;
  const savedCount = events.filter((e) => wishlistedIds.has(e.id)).length;

  function clearFilters() {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedType('');
    setSelectedGenres(new Set());
    // Reset to user's default location (proximity mode)
    setLocationFilter({ city: userCity, country: userCountry, label: userCity ? `${userCity}, ${userCountry}` : '' });
    setResetLocationKey((k) => k + 1);
  }

  function handleEventClick(eventId: string) {
    router.push(`/${locale}/discover/${eventId}`);
  }

  return (
    <div className="space-y-4">
      {/* Location Selector */}
      <LocationSelector
        key={resetLocationKey}
        defaultCity={userCity}
        defaultCountry={userCountry}
        availableCities={availableCities}
        availableCountries={availableCountries}
        onLocationChange={handleLocationChange}
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'all'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Music className="h-4 w-4" />
          {t('tabAll')}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('saved')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'saved'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bookmark className="h-4 w-4" />
          {t('tabSaved')}
          {savedCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary">
              {savedCount}
            </span>
          )}
        </button>
      </div>

      {/* Genre pills (top 5 personalized) + dropdown */}
      {topGenres.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {topGenres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                selectedGenres.has(genre)
                  ? 'bg-primary/20 border border-primary text-primary'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
              )}
            >
              {genre}
            </button>
          ))}
          {extraGenres.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) toggleGenre(e.target.value);
                e.target.value = '';
              }}
              className="h-7 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground focus:border-primary focus:outline-none"
            >
              <option value="">{t('moreGenres')}</option>
              {extraGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {selectedGenres.has(genre) ? `✓ ${genre}` : genre}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Search + filter toggle + view mode */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
            showFilters || hasActiveFilters
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('clearFilters')}
          </button>
        )}

        {/* View mode toggle */}
        <div className="ml-auto flex rounded-md border border-border">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-none rounded-l-md"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-none border-x border-border"
            onClick={() => setViewMode('list')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-none rounded-r-md"
            onClick={() => setViewMode('timeline')}
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter row (collapsible) */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">{t('allTypes')}</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>{tTypes(type)}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="date_asc">{t('sortDateAsc')}</option>
              <option value="date_desc">{t('sortDateDesc')}</option>
              <option value="name">{t('sortName')}</option>
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          {activeTab === 'saved'
            ? `${filteredEvents.length} ${t('tabSaved').toLowerCase()}`
            : `${total} ${total === 1 ? 'resultado' : 'resultados'}`}
        </p>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredEvents.length === 0 ? (
        /* Empty states */
        activeTab === 'saved' ? (
          <div className="py-16 text-center">
            <Bookmark className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">{t('noSavedEvents')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('noSavedEventsHint')}</p>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Music className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              {hasActiveFilters ? t('noEventsFound') : t('noEventsAvailable')}
            </p>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">
                {t('clearFiltersAction')}
              </button>
            )}
          </div>
        )
      ) : viewMode === 'timeline' ? (
        <DiscoverTimeline
          groups={groupedByMonth}
          locale={locale}
          tTypes={tTypes}
          wishlistedIds={wishlistedIds}
          onWishlistToggle={handleWishlistToggle}
          onClick={handleEventClick}
        />
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-2">
          {filteredEvents.map((event) => (
            <DiscoverListItem
              key={event.id}
              event={event}
              locale={locale}
              tTypes={tTypes}
              isWishlisted={wishlistedIds.has(event.id)}
              onWishlistToggle={handleWishlistToggle}
              onClick={() => handleEventClick(event.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <DiscoverGridCard
              key={event.id}
              event={event}
              locale={locale}
              tTypes={tTypes}
              isWishlisted={wishlistedIds.has(event.id)}
              onWishlistToggle={handleWishlistToggle}
              onClick={() => handleEventClick(event.id)}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && activeTab === 'all' && !loading && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Grid Card ── */
function DiscoverGridCard({
  event,
  locale,
  tTypes,
  isWishlisted,
  onWishlistToggle,
  onClick,
}: {
  event: GlobalEventWithJoins;
  locale: string;
  tTypes: (key: string) => string;
  isWishlisted: boolean;
  onWishlistToggle: (id: string, w: boolean) => void;
  onClick: () => void;
}) {
  const city = event.city ?? event.venues?.city ?? '';
  const artists = event.global_event_artists ?? [];
  const headliner = artists.find((a) => a.role === 'headliner');

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg"
      onClick={onClick}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-encore-navy">
        {event.poster_url ? (
          <Image src={event.poster_url} alt={event.name} fill className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        ) : headliner?.artists.image_url ? (
          <Image src={headliner.artists.image_url} alt={event.name} fill className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-10 w-10 text-white/10" />
          </div>
        )}

        <div className="absolute left-2 top-2">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {tTypes(event.event_type)}
          </span>
        </div>

        <div className="absolute right-2 top-2 z-10">
          <WishlistButton
            globalEventId={event.id}
            initialWishlisted={isWishlisted}
            variant="overlay"
            onToggle={(w) => onWishlistToggle(event.id, w)}
          />
        </div>
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-semibold">{event.name}</h3>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(event.date).toLocaleDateString(locale, {
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
        {artists.length > 0 && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {artists.slice(0, 3).map((a) => a.artists.name).join(', ')}
            {artists.length > 3 && ` +${artists.length - 3}`}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── List Item ── */
function DiscoverListItem({
  event,
  locale,
  tTypes,
  isWishlisted,
  onWishlistToggle,
  onClick,
}: {
  event: GlobalEventWithJoins;
  locale: string;
  tTypes: (key: string) => string;
  isWishlisted: boolean;
  onWishlistToggle: (id: string, w: boolean) => void;
  onClick: () => void;
}) {
  const city = event.city ?? event.venues?.city ?? '';
  const artists = event.global_event_artists ?? [];
  const headliner = artists.find((a) => a.role === 'headliner');
  const image = event.poster_url ?? headliner?.artists.image_url ?? null;

  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30"
      onClick={onClick}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-encore-navy">
        {image ? (
          <Image src={image} alt={event.name} fill className="object-cover" sizes="56px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-5 w-5 text-white/20" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold">{event.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(event.date).toLocaleDateString(locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          {city && ` · ${city}`}
          {artists.length > 0 && ` · ${artists.map((a) => a.artists.name).join(', ')}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {tTypes(event.event_type)}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <WishlistButton
            globalEventId={event.id}
            initialWishlisted={isWishlisted}
            variant="icon"
            onToggle={(w) => onWishlistToggle(event.id, w)}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Timeline View ── */
function DiscoverTimeline({
  groups,
  locale,
  tTypes,
  wishlistedIds,
  onWishlistToggle,
  onClick,
}: {
  groups: { label: string; events: GlobalEventWithJoins[] }[];
  locale: string;
  tTypes: (key: string) => string;
  wishlistedIds: Set<string>;
  onWishlistToggle: (id: string, w: boolean) => void;
  onClick: (id: string) => void;
}) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

      {groups.map((group) => (
        <div key={group.label} className="mb-8 last:mb-0">
          <div className="relative mb-4 flex items-center">
            <div className="absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-encore-navy">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <h3 className="text-sm font-semibold capitalize text-primary">
              {group.label}
            </h3>
          </div>

          <div className="space-y-3">
            {group.events.map((event) => {
              const city = event.city ?? event.venues?.city ?? '';
              const artists = event.global_event_artists ?? [];
              const headliner = artists.find((a) => a.role === 'headliner');
              const image = event.poster_url ?? headliner?.artists.image_url ?? null;

              return (
                <div
                  key={event.id}
                  className="relative cursor-pointer rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30"
                  onClick={() => onClick(event.id)}
                >
                  <div className="absolute -left-[calc(2rem+3.5px)] top-4 h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />

                  <div className="flex items-start gap-3">
                    {image && (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-encore-navy">
                        <Image src={image} alt={event.name} fill className="object-cover" sizes="48px" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-tight">{event.name}</h4>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {tTypes(event.event_type)}
                          </span>
                          <div onClick={(e) => e.stopPropagation()}>
                            <WishlistButton
                              globalEventId={event.id}
                              initialWishlisted={wishlistedIds.has(event.id)}
                              variant="icon"
                              onToggle={(w) => onWishlistToggle(event.id, w)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          {new Date(event.date).toLocaleDateString(locale, {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        {city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {city}
                          </span>
                        )}
                      </div>

                      {artists.length > 0 && (
                        <p className="mt-1 truncate text-xs text-muted-foreground/70">
                          {artists.map((a) => a.artists.name).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
