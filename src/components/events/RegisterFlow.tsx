'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
// Note: We use simple buttons instead of Radix Select to avoid
// a known infinite loop bug with @radix-ui/react-presence@1.1.5
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, ChevronLeft, ChevronRight, Check, Star, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { revalidateCollection } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArtistGrid } from '@/components/artists/ArtistGrid';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import type { EventType } from '@/types';

// ─── Schema ─────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  date: z.string().min(1, 'Date is required'),
  city: z.string().min(1, 'City is required'),
  eventType: z.enum(['concert', 'festival', 'club_show', 'theater', 'special']),
  artistIds: z.array(z.string()),
  globalEventId: z.string().nullable().optional(),
  venueName: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  mood: z.string().optional(),
  notes: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

// ─── Types ──────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  name: string;
  type: 'event' | 'artist';
  subtitle?: string;
}

interface ArtistOption {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
}

// ─── Component ──────────────────────────────────────────────────

export function RegisterFlow() {
  const supabase = useSupabase();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useTranslations('register');
  const tTypes = useTranslations('eventTypes');
  const tMoods = useTranslations('moods');

  const [step, setStep] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [availableArtists, setAvailableArtists] = React.useState<ArtistOption[]>([]);
  const [selectedEventType, setSelectedEventType] = React.useState<EventType>('concert');
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [duplicateEvent, setDuplicateEvent] = React.useState<{ id: string; name: string } | null>(null);
  // Whether a global event is selected (locks metadata fields)
  const [isGlobalEvent, setIsGlobalEvent] = React.useState(false);
  // Validation error for search field when trying to advance without selecting
  const [searchError, setSearchError] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      eventType: 'concert',
      artistIds: [],
      globalEventId: null,
    },
  });

  const selectedArtistIds = watch('artistIds');

  // Debounced search
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      // Search global events (only past events — you can't register attendance for future events)
      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabase
        .from('global_events')
        .select('id, name, date, city')
        .ilike('name', `%${value}%`)
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(5);

      // Search artists
      const { data: artists } = await supabase
        .from('artists')
        .select('id, name, genres')
        .ilike('name_normalized', `%${value.toLowerCase()}%`)
        .limit(5);

      const results: SearchResult[] = [
        ...(events?.map((e) => ({
          id: e.id,
          name: e.name,
          type: 'event' as const,
          subtitle: `${e.city ?? ''} · ${e.date}`,
        })) ?? []),
        ...(artists?.map((a) => ({
          id: a.id,
          name: a.name,
          type: 'artist' as const,
          subtitle: (a.genres as string[])?.slice(0, 2).join(', ') || 'Artist',
        })) ?? []),
      ];

      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  }

  async function handleResultSelect(result: SearchResult) {
    if (result.type === 'event') {
      // Check for duplicate IMMEDIATELY when a global event is selected
      if (user) {
        const { data: existing } = await supabase
          .from('user_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('global_event_id', result.id)
          .maybeSingle();

        if (existing) {
          setDuplicateEvent({ id: existing.id, name: result.name });
          setSearchResults([]);
          return;
        }
      }

      // Load event details
      const { data: event } = await supabase
        .from('global_events')
        .select('id, name, date, city, event_type')
        .eq('id', result.id)
        .single();

      if (event) {
        setValue('name', event.name);
        setValue('date', event.date);
        setValue('city', event.city ?? '');
        setValue('eventType', event.event_type as EventType);
        setValue('globalEventId', event.id);
        setSelectedEventType(event.event_type as EventType);
        setIsGlobalEvent(true);
      }

      // Load artists for this event
      const { data: eventArtists } = await supabase
        .from('global_event_artists')
        .select('artist_id, role, artists:artist_id (id, name, image_url, genres)')
        .eq('global_event_id', result.id)
        .order('billing_order', { ascending: true }) as {
          data: Array<{
            artist_id: string;
            role: string;
            artists: { id: string; name: string; image_url: string | null; genres: string[] };
          }> | null;
        };

      if (eventArtists) {
        const artistOptions = eventArtists.map((ea) => ({
          id: ea.artists.id,
          name: ea.artists.name,
          imageUrl: ea.artists.image_url,
          genres: ea.artists.genres ?? [],
        }));
        setAvailableArtists(artistOptions);
        // Auto-select all artists
        setValue('artistIds', artistOptions.map((a) => a.id));
      }
    } else {
      // Artist selected directly — add to artist list
      const { data: artist } = await supabase
        .from('artists')
        .select('id, name, image_url, genres')
        .eq('id', result.id)
        .single();

      if (artist) {
        const option: ArtistOption = {
          id: artist.id,
          name: artist.name,
          imageUrl: artist.image_url,
          genres: artist.genres ?? [],
        };
        setAvailableArtists((prev) => {
          if (prev.some((a) => a.id === option.id)) return prev;
          return [...prev, option];
        });
        setValue('artistIds', [...selectedArtistIds, artist.id]);
      }
    }
    setSearchResults([]);
    setSearchQuery(result.name);
  }

  function handleArtistToggle(artistId: string) {
    const current = selectedArtistIds;
    const updated = current.includes(artistId)
      ? current.filter((id) => id !== artistId)
      : [...current, artistId];
    setValue('artistIds', updated);
  }

  function resetForm() {
    reset({ eventType: 'concert', artistIds: [], globalEventId: null });
    setStep(1);
    setSearchQuery('');
    setAvailableArtists([]);
    setIsGlobalEvent(false);
    setSelectedEventType('concert');
    setDuplicateEvent(null);
    setSubmitSuccess(false);
    setSearchError(false);
  }

  const isFestival = selectedEventType === 'festival';

  async function onFormSubmit(data: RegisterFormData) {
    if (!user) return;

    // Create user_event
    const { data: userEvent, error: eventError } = await supabase
      .from('user_events')
      .insert({
        user_id: user.id,
        global_event_id: data.globalEventId ?? null,
        custom_event_name: data.name,
        custom_event_date: data.date,
        custom_event_city: data.city,
        event_type: data.eventType,
        rating: data.rating ?? null,
        mood: data.mood ?? null,
        notes: data.notes ?? null,
      })
      .select('id')
      .single();

    if (eventError || !userEvent) {
      console.error('Error creating event:', eventError);
      return;
    }

    // Link artists
    if (data.artistIds.length > 0) {
      const artistLinks = data.artistIds.map((artistId) => ({
        user_event_id: userEvent.id,
        artist_id: artistId,
        user_id: user.id,
      }));

      const { error: artistError } = await supabase
        .from('user_event_artists')
        .insert(artistLinks);

      if (artistError) {
        console.error('Error linking artists:', artistError);
      }
    }

    // Revalidate server-side caches (collection, stats pages)
    await revalidateCollection();
    // Invalidate React Query cache (stats uses useQuery)
    queryClient.invalidateQueries({ queryKey: ['user-stats'] });

    setSubmitSuccess(true);
  }

  // ─── Duplicate detected screen ─────────────────────────────────

  if (duplicateEvent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
            <ExternalLink className="h-8 w-8 text-yellow-500" />
          </div>
          <h2 className="mt-4 text-xl font-bold">{t('duplicateTitle')}</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t('duplicateDescription', { name: duplicateEvent.name })}
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={resetForm}>
              {t('duplicateRegisterOther')}
            </Button>
            <Button onClick={() => router.push(`/${locale}/event/${duplicateEvent.id}/edit`)}>
              {t('duplicateEditExisting')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Success screen ────────────────────────────────────────────

  if (submitSuccess) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
            <Check className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="mt-4 text-xl font-bold">{t('successTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('successDescription')}
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={resetForm}>
              {t('registerAnother')}
            </Button>
            <Button onClick={() => router.push(`/${locale}/collection`)}>
              {t('viewCollection')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Registration form ─────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step indicators */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
              s === step
                ? 'bg-primary text-white'
                : s < step
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {s < step ? <Check className="h-4 w-4" /> : s}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)}>
        {/* Step 1: Search + event details */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('searchPlaceholder').replace('...', '')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className={cn(
                  'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
                  searchError ? 'text-red-500' : 'text-muted-foreground'
                )} />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    handleSearchChange(e.target.value);
                    if (searchError) setSearchError(false);
                    // If user clears/changes the search, unlock fields
                    if (isGlobalEvent) {
                      setIsGlobalEvent(false);
                      setValue('globalEventId', null);
                      setValue('name', '');
                      setValue('date', '');
                      setValue('city', '');
                      setValue('eventType', 'concert');
                      setSelectedEventType('concert');
                      setAvailableArtists([]);
                      setValue('artistIds', []);
                    }
                  }}
                  placeholder={t('searchPlaceholder')}
                  className={cn('pl-10', searchError && 'border-red-500 focus:border-red-500 focus:ring-red-500')}
                />
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => handleResultSelect(result)}
                      >
                        <span className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                          result.type === 'event' ? 'bg-primary/20 text-primary' : 'bg-accent text-accent-foreground'
                        )}>
                          {result.type === 'event' ? 'Evento' : 'Artista'}
                        </span>
                        <span className="font-medium">{result.name}</span>
                        {result.subtitle && (
                          <span className="text-muted-foreground text-xs">
                            {result.subtitle}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
              {searchError && (
                <p className="text-xs text-red-500">{t('searchRequired')}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('eventName')}</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder={t('eventName')}
                    disabled
                    className="opacity-60"
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">{t('eventDate')}</Label>
                  <Input
                    id="date"
                    type="date"
                    {...register('date')}
                    disabled
                    className="opacity-60"
                  />
                  {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t('eventCity')}</Label>
                  <Input
                    id="city"
                    {...register('city')}
                    placeholder={t('eventCity')}
                    disabled
                    className="opacity-60"
                  />
                  {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('eventType')}</Label>
                  <Controller
                    control={control}
                    name="eventType"
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          ['concert', 'concert'],
                          ['festival', 'festival'],
                          ['club_show', 'club_show'],
                          ['theater', 'theater'],
                          ['special', 'special'],
                        ] as const).map(([value, labelKey]) => (
                          <button
                            key={value}
                            type="button"
                            disabled
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors opacity-60 cursor-not-allowed',
                              field.value === value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground'
                            )}
                          >
                            {tTypes(labelKey)}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    if (!isGlobalEvent) {
                      setSearchError(true);
                      return;
                    }
                    setStep(2);
                  }}
                  className="gap-1"
                >
                  {t('next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Artist selection */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isFestival ? t('selectArtists') : t('selectArtists')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableArtists.length > 0 ? (
                <ArtistGrid
                  artists={availableArtists.map((a) => ({
                    id: a.id,
                    name: a.name,
                    imageUrl: a.imageUrl,
                    genres: a.genres,
                  }))}
                  selectedIds={selectedArtistIds}
                  onToggle={handleArtistToggle}
                  selectable
                />
              ) : (
                <div className="rounded-lg bg-muted p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No se encontraron artistas para este evento.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Puedes buscar artistas en el paso anterior o continuar sin artistas.
                  </p>
                </div>
              )}

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  {t('back')}
                </Button>
                <Button type="button" onClick={() => setStep(3)} className="gap-1">
                  {t('next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Rating, mood, notes & confirm */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('confirmButton').replace('!', '')} — {watch('name') || ''}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Event summary (read-only) */}
              <div className="rounded-lg bg-muted p-4 space-y-1.5 text-sm">
                <p><span className="font-medium">{t('eventName')}:</span> {watch('name') || '-'}</p>
                <p><span className="font-medium">{t('eventDate')}:</span> {watch('date') || '-'}</p>
                <p><span className="font-medium">{t('eventCity')}:</span> {watch('city') || '-'}</p>
                <p><span className="font-medium">{t('eventType')}:</span> {tTypes(watch('eventType'))}</p>
                <p><span className="font-medium">Artistas:</span> {selectedArtistIds.length} {t('selectArtists').toLowerCase().includes('artistas') ? 'seleccionados' : 'selected'}</p>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <Label>{t('rating')}</Label>
                <Controller
                  control={control}
                  name="rating"
                  render={({ field }) => (
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => field.onChange(field.value === star ? undefined : star)}
                          className="p-1"
                        >
                          <Star
                            className={cn(
                              'h-6 w-6 transition-colors',
                              field.value && star <= field.value
                                ? 'fill-secondary text-secondary'
                                : 'text-muted-foreground'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Mood */}
              <div className="space-y-2">
                <Label>{t('mood')}</Label>
                <Controller
                  control={control}
                  name="mood"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
                      {(['epic', 'intimate', 'euphoric', 'nostalgic', 'transcendent', 'rainy'] as const).map((mood) => (
                        <button
                          key={mood}
                          type="button"
                          onClick={() => field.onChange(field.value === mood ? undefined : mood)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            field.value === mood
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          )}
                        >
                          {tMoods(mood)}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">{t('notes')}</Label>
                <Input id="notes" {...register('notes')} placeholder={t('notes')} />
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  {t('back')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-1">
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {t('confirmButton')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
