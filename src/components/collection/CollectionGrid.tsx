'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  LayoutGrid,
  List,
  Clock,
  Search,
  X,
  Calendar,
  MapPin,
  Star,
  Music,
  Users,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react';
import Image from 'next/image';

import { useQueryClient } from '@tanstack/react-query';

import { cn, formatEventDate, formatMonthYear } from '@/lib/utils';
import { revalidateCollection } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSupabase } from '@/hooks/useSupabase';
import type { UserEvent, Venue, Artist, UserEventArtist, GlobalEvent } from '@/lib/supabase/types';
import type { EventType } from '@/types';

type UserEventWithJoins = UserEvent & {
  global_events: (GlobalEvent & { venues: Venue | null }) | null;
  user_event_artists: Array<UserEventArtist & { artists: Artist }>;
};

interface CollectionGridProps {
  initialEvents: UserEventWithJoins[];
}

type ViewMode = 'grid' | 'list' | 'timeline';

function getEventDate(e: UserEventWithJoins): string {
  return e.custom_event_date ?? e.global_events?.date ?? '';
}

function getEventName(e: UserEventWithJoins): string {
  return e.custom_event_name ?? e.global_events?.name ?? '';
}

function getEventCity(e: UserEventWithJoins): string {
  return e.custom_event_city ?? e.global_events?.venues?.city ?? '';
}

function getEventImage(e: UserEventWithJoins): string | null {
  // First artist alphabetically that has an image
  const firstArtistImage = [...(e.user_event_artists ?? [])]
    .sort((a, b) => a.artists.name.localeCompare(b.artists.name))
    .find(a => a.artists.image_url)
    ?.artists.image_url ?? null;

  if (e.event_type === 'festival') {
    // Festivals: DuckDuckGo poster > first artist alphabetically
    return e.global_events?.poster_url ?? firstArtistImage;
  }
  // Concerts: first artist alphabetically > poster_url as last resort
  return firstArtistImage ?? e.global_events?.poster_url ?? null;
}

export function CollectionGrid({ initialEvents }: CollectionGridProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('collection');
  const tTypes = useTranslations('eventTypes');
  const supabase = useSupabase();

  const queryClient = useQueryClient();
  const [events, setEvents] = React.useState(initialEvents);
  const [viewMode, setViewModeRaw] = React.useState<ViewMode>('grid');
  const setViewMode = React.useCallback((mode: ViewMode) => {
    setViewModeRaw(mode);
    localStorage.setItem('collection-view-mode', mode);
  }, []);

  // Restore persisted view mode after hydration
  React.useEffect(() => {
    const saved = localStorage.getItem('collection-view-mode') as ViewMode | null;
    if (saved && saved !== 'grid') setViewModeRaw(saved);
  }, []);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState<string>('');
  const [selectedTypes, setSelectedTypes] = React.useState<Set<string>>(new Set());
  const [selectedGenres, setSelectedGenres] = React.useState<Set<string>>(new Set());
  const [editMode, setEditMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<{ ids: string[]; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Sync if parent re-renders with new data
  React.useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  // Extract unique years
  const years = React.useMemo(() => {
    const yearSet = new Set<string>();
    events.forEach((e) => {
      const date = getEventDate(e);
      if (date) yearSet.add(date.substring(0, 4));
    });
    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [events]);

  // Extract unique event types
  const eventTypes = React.useMemo(() => {
    const typeSet = new Set<string>();
    events.forEach((e) => {
      if (e.event_type) typeSet.add(e.event_type);
    });
    return Array.from(typeSet).sort();
  }, [events]);

  // Top 5 genres by frequency in user's collection + rest for dropdown
  const { topGenres, extraGenres } = React.useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((e) => {
      e.user_event_artists?.forEach((ea) => {
        (ea.artists.genres as string[] | null)?.forEach((g) => {
          counts.set(g, (counts.get(g) ?? 0) + 1);
        });
      });
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([g]) => g);
    const extra = sorted.slice(5).map(([g]) => g).sort();
    return { topGenres: top, extraGenres: extra };
  }, [events]);

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else {
        next.add(genre);
      }
      return next;
    });
  }

  // Filter and sort
  const filtered = React.useMemo(() => {
    let result = [...events];

    if (selectedYear) {
      result = result.filter((e) => getEventDate(e).startsWith(selectedYear));
    }

    if (selectedTypes.size > 0) {
      result = result.filter((e) => selectedTypes.has(e.event_type));
    }

    if (selectedGenres.size > 0) {
      result = result.filter((e) =>
        e.user_event_artists?.some((ea) =>
          (ea.artists.genres as string[] | null)?.some((g) => selectedGenres.has(g))
        )
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          getEventName(e).toLowerCase().includes(q) ||
          getEventCity(e).toLowerCase().includes(q) ||
          e.user_event_artists.some((ea) =>
            ea.artists.name.toLowerCase().includes(q)
          )
      );
    }

    result.sort((a, b) => {
      const dateA = getEventDate(a);
      const dateB = getEventDate(b);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return result;
  }, [events, selectedYear, selectedTypes, selectedGenres, searchQuery]);

  const hasFilters = selectedYear || selectedTypes.size > 0 || selectedGenres.size > 0 || searchQuery;

  function clearFilters() {
    setSelectedYear('');
    setSelectedTypes(new Set());
    setSelectedGenres(new Set());
    setSearchQuery('');
  }

  function handleClick(eventId: string) {
    if (editMode) {
      // Toggle selection in edit mode
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(eventId)) {
          next.delete(eventId);
        } else {
          next.add(eventId);
        }
        return next;
      });
      return;
    }
    router.push(`/${locale}/event/${eventId}`);
  }

  function handleDeleteSingle(event: UserEventWithJoins) {
    setDeleteTarget({ ids: [event.id], name: getEventName(event) });
  }

  function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    const name = selectedIds.size === 1
      ? getEventName(events.find((e) => selectedIds.has(e.id))!)
      : t('selectedCount', { count: selectedIds.size });
    setDeleteTarget({ ids: Array.from(selectedIds), name });
  }

  function handleSelectAll() {
    const filteredIds = filtered.map((e) => e.id);
    const allSelected = filteredIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  }

  function exitEditMode() {
    setEditMode(false);
    setSelectedIds(new Set());
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const idsToDelete = deleteTarget.ids;
    setIsDeleting(true);

    try {
      // user_event_artists cascade-deletes automatically (ON DELETE CASCADE)
      const { error } = await supabase
        .from('user_events')
        .delete()
        .in('id', idsToDelete);

      if (!error) {
        const deleteSet = new Set(idsToDelete);
        setEvents((prev) => prev.filter((e) => !deleteSet.has(e.id)));
        setSelectedIds(new Set());
      }
    } catch (err) {
      console.error('Error deleting events:', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      await revalidateCollection();
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      router.refresh();
    }
  }

  // Group events by month for timeline view
  const groupedByMonth = React.useMemo(() => {
    const groups: { label: string; events: UserEventWithJoins[] }[] = [];
    let currentLabel = '';

    filtered.forEach((event) => {
      const date = getEventDate(event);
      if (!date) return;
      const d = new Date(date);
      const label = formatMonthYear(d, locale);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, events: [] });
      }
      groups[groups.length - 1].events.push(event);
    });

    return groups;
  }, [filtered, locale]);

  return (
    <div className="space-y-4">
      {/* Quick year pills */}
      {years.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedYear('')}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              !selectedYear
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
            )}
          >
            {t('allYears')}
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(selectedYear === year ? '' : year)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                selectedYear === year
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
              )}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Quick type pills */}
      {eventTypes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {eventTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                selectedTypes.has(type)
                  ? 'bg-secondary/20 border border-secondary text-secondary'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-secondary/50'
              )}
            >
              {tTypes(type)}
            </button>
          ))}
        </div>
      )}

      {/* Genre pills (top 5 by frequency) + dropdown for rest */}
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

      {/* Search bar + edit toggle + view toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
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

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('clearFilters')}
          </button>
        )}

        {/* Edit mode controls */}
        {events.length > 0 && !editMode && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setEditMode(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {t('edit')}
          </Button>
        )}
        {editMode && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={handleSelectAll}
            >
              {filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id))
                ? t('deselectAll')
                : t('selectAll')}
            </Button>
            {selectedIds.size > 0 && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('deleteSelected', { count: selectedIds.size })}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary"
              onClick={exitEditMode}
            >
              {t('done')}
            </Button>
          </>
        )}

        <div className="ml-auto flex rounded-md border border-border">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-none rounded-l-md"
            onClick={() => setViewMode('grid')}
            title={t('gridView')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-none border-x border-border"
            onClick={() => setViewMode('list')}
            title={t('listView')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 rounded-none rounded-r-md"
            onClick={() => setViewMode('timeline')}
            title={t('timelineView')}
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Results count */}
      {hasFilters && (
        <p className="text-xs text-muted-foreground">
          {t('resultsCount', { count: filtered.length })}
        </p>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          {events.length === 0 ? (
            <>
              <Music className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium text-muted-foreground">
                {t('emptyCollection')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('emptyCollectionCta')}
              </p>
            </>
          ) : (
            <>
              <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium text-muted-foreground">
                {t('noResults')}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 text-sm text-primary hover:underline"
              >
                {t('clearFilters')}
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'timeline' ? (
        <TimelineView
          groups={groupedByMonth}
          locale={locale}
          onClick={handleClick}
          tTypes={tTypes}
          editMode={editMode}
          selectedIds={selectedIds}
          onDelete={handleDeleteSingle}
        />
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-2">
          {filtered.map((event) => (
            <ListItem
              key={event.id}
              event={event}
              locale={locale}
              onClick={() => handleClick(event.id)}
              tTypes={tTypes}
              editMode={editMode}
              isSelected={selectedIds.has(event.id)}
              onDelete={() => handleDeleteSingle(event)}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((event) => (
            <GridCard
              key={event.id}
              event={event}
              locale={locale}
              onClick={() => handleClick(event.id)}
              tTypes={tTypes}
              editMode={editMode}
              isSelected={selectedIds.has(event.id)}
              onDelete={() => handleDeleteSingle(event)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('deleteCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? t('deleting') : t('deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Delete Button ─── */
function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Delete event"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition-transform hover:scale-110 hover:bg-red-700"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/* ─── Grid Card ─── */
function GridCard({
  event,
  locale,
  onClick,
  tTypes,
  editMode,
  isSelected,
  onDelete,
}: {
  event: UserEventWithJoins;
  locale: string;
  onClick: () => void;
  tTypes: (key: string) => string;
  editMode: boolean;
  isSelected: boolean;
  onDelete: () => void;
}) {
  const image = getEventImage(event);
  const name = getEventName(event);
  const city = getEventCity(event);
  const date = getEventDate(event);
  const artists = event.user_event_artists ?? [];

  return (
    <div
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl border-2 bg-card transition-all hover:shadow-lg',
        editMode
          ? isSelected ? 'border-red-500 ring-2 ring-red-500/30' : 'border-border hover:border-red-500/40'
          : 'border-border hover:border-primary/30'
      )}
      onClick={onClick}
    >
      {/* Delete badge — only in edit mode */}
      {editMode && (
        <div className="absolute right-2 top-2 z-20">
          <DeleteButton onClick={onDelete} />
        </div>
      )}

      <div className="relative aspect-[3/2] overflow-hidden bg-encore-navy">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
              style={{ objectPosition: '50% 15%' }}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
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

        {!editMode && event.rating !== null && (
          <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
            <Star className="h-3 w-3 fill-secondary text-secondary" />
            <span className="text-[11px] font-semibold text-white">{event.rating}</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-semibold">{name}</h3>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatEventDate(date, locale)}
          </span>
          {city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {city}
            </span>
          )}
        </div>
        {artists.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Users className="h-3 w-3" />
              {artists.length}
            </span>
            <p className="truncate text-xs text-muted-foreground">
              {artists.slice(0, 2).map((a) => a.artists.name).join(', ')}
              {artists.length > 2 && ` +${artists.length - 2}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── List Item ─── */
function ListItem({
  event,
  locale,
  onClick,
  tTypes,
  editMode,
  isSelected,
  onDelete,
}: {
  event: UserEventWithJoins;
  locale: string;
  onClick: () => void;
  tTypes: (key: string) => string;
  editMode: boolean;
  isSelected: boolean;
  onDelete: () => void;
}) {
  const image = getEventImage(event);
  const name = getEventName(event);
  const city = getEventCity(event);
  const date = getEventDate(event);
  const artists = event.user_event_artists ?? [];

  return (
    <div
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border-2 bg-card p-3 transition-colors',
        editMode
          ? isSelected ? 'border-red-500 ring-2 ring-red-500/30' : 'border-border hover:border-red-500/40'
          : 'border-border hover:border-primary/30'
      )}
      onClick={onClick}
    >
      {/* Trash in edit mode */}
      {editMode && (
        <div className="shrink-0">
          <DeleteButton onClick={onDelete} />
        </div>
      )}

      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-encore-navy">
        {image ? (
          <Image src={image} alt={name} fill className="object-cover" sizes="56px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-5 w-5 text-white/20" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold">{name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatEventDate(date, locale)}
          {city && ` · ${city}`}
          {artists.length > 0 && ` · ${artists.length} artistas`}
        </p>
      </div>

      {!editMode && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tTypes(event.event_type)}
          </span>
          {event.rating !== null && (
            <div className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-secondary text-secondary" />
              <span className="text-xs font-medium">{event.rating}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Timeline View ─── */
function TimelineView({
  groups,
  locale,
  onClick,
  tTypes,
  editMode,
  selectedIds,
  onDelete,
}: {
  groups: { label: string; events: UserEventWithJoins[] }[];
  locale: string;
  onClick: (id: string) => void;
  tTypes: (key: string) => string;
  editMode: boolean;
  selectedIds: Set<string>;
  onDelete: (event: UserEventWithJoins) => void;
}) {
  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

      {groups.map((group) => (
        <div key={group.label} className="mb-8 last:mb-0">
          {/* Month/Year label */}
          <div className="relative mb-4 flex items-center">
            <div className="absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-encore-navy">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <h3 className="text-sm font-semibold capitalize text-primary">
              {group.label}
            </h3>
          </div>

          {/* Events in this month */}
          <div className="space-y-3">
            {group.events.map((event) => {
              const image = getEventImage(event);
              const name = getEventName(event);
              const city = getEventCity(event);
              const date = getEventDate(event);
              const artists = event.user_event_artists ?? [];

              const isSelected = selectedIds.has(event.id);

              return (
                <div
                  key={event.id}
                  className={cn(
                    'relative cursor-pointer rounded-lg border-2 bg-card p-3 transition-colors',
                    editMode
                      ? isSelected ? 'border-red-500 ring-2 ring-red-500/30' : 'border-border hover:border-red-500/40'
                      : 'border-border hover:border-primary/30'
                  )}
                  onClick={() => onClick(event.id)}
                >
                  {/* Small dot on the timeline */}
                  <div className="absolute -left-[calc(2rem+3.5px)] top-4 h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />

                  <div className="flex items-start gap-3">
                    {/* Delete in timeline */}
                    {editMode && (
                      <div className="shrink-0 pt-0.5">
                        <DeleteButton onClick={() => onDelete(event)} />
                      </div>
                    )}

                    {image && (
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-encore-navy">
                        <Image src={image} alt={name} fill className="object-cover" sizes="48px" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-tight">{name}</h4>
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {tTypes(event.event_type)}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          {formatEventDate(date, locale)}
                        </span>
                        {city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {city}
                          </span>
                        )}
                        {event.rating !== null && (
                          <span className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-secondary text-secondary" />
                            {event.rating}
                          </span>
                        )}
                      </div>

                      {artists.length > 0 && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Users className="h-2.5 w-2.5" />
                            {artists.length}
                          </span>
                          <p className="truncate text-xs text-muted-foreground/70">
                            {artists.slice(0, 3).map((a) => a.artists.name).join(', ')}
                            {artists.length > 3 && ` +${artists.length - 3}`}
                          </p>
                        </div>
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
