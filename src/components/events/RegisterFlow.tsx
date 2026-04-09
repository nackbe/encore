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
import { useToast } from '@/hooks/useToast';
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
  city: z.string().default(''),
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

interface UnifiedResult {
  source: 'local' | 'setlistfm' | 'bandsintown' | 'musicbrainz';
  source_id: string;
  name: string;
  date: string;
  date_end?: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  event_type: string;
  poster_url: string | null;
  artists: Array<{ name: string; image_url: string | null; mbid?: string }>;
  lat: number | null;
  lng: number | null;
  local_event_id?: string;
  matched_artist?: string;
}

interface SearchResult {
  id: string;
  name: string;
  type: 'event' | 'artist';
  subtitle?: string;
  unified?: UnifiedResult; // full data from unified search
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
  const { toast } = useToast();
  const t = useTranslations('register');
  const tError = useTranslations('error');
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
  // Pending external event to import on final submit (deferred import)
  const [pendingUnified, setPendingUnified] = React.useState<UnifiedResult | null>(null);
  // Validation error for search field when trying to advance without selecting
  const [searchError, setSearchError] = React.useState(false);
  // Track when search returned zero results (for fallback suggestions)
  const [noResults, setNoResults] = React.useState(false);

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

  // Debounced search with abort controller
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  const abortRef = React.useRef<AbortController>();

  // Cleanup on unmount (prevents stale requests from HMR or navigation)
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (searchError) setSearchError(false);

    // User is typing something new — unlock locked fields if an event was selected
    if (isGlobalEvent) {
      setIsGlobalEvent(false);
      setPendingUnified(null);
      setValue('globalEventId', null);
      setValue('name', '');
      setValue('date', '');
      setValue('city', '');
      setValue('eventType', 'concert');
      setSelectedEventType('concert');
      setAvailableArtists([]);
      setValue('artistIds', []);
    }

    if (value.length < 4) {
      setSearchResults([]);
      setNoResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setNoResults(false);
    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      // Auto-timeout after 10s to prevent hanging after idle
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(`/api/events/search?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (controller.signal.aborted) return;

        if (!res.ok) {
          setSearchResults([]);
          setNoResults(true);
          setIsSearching(false);
          return;
        }

        const data = await res.json() as { results: UnifiedResult[] };
        if (controller.signal.aborted) return;

        const results: SearchResult[] = (data.results ?? []).map((r) => ({
          id: r.local_event_id ?? `${r.source}:${r.source_id}`,
          name: r.name,
          type: 'event' as const,
          subtitle: [
            r.matched_artist ? `♪ ${r.matched_artist}` : null,
            r.city,
            r.country,
            r.date,
          ].filter(Boolean).join(' · '),
          unified: r,
        }));

        // Show event results immediately — don't wait for artist search
        if (!controller.signal.aborted) {
          setSearchResults(results);
          setNoResults(results.length === 0);
          setIsSearching(results.length === 0); // keep spinner only if no events yet
        }

        // Also search local artists (unified API doesn't return standalone artists)
        try {
          const { data: artists } = await supabase
            .from('artists')
            .select('id, name, genres')
            .ilike('name_normalized', `%${value.toLowerCase()}%`)
            .limit(5);

          if (!controller.signal.aborted && artists?.length) {
            setSearchResults((prev) => [
              ...prev,
              ...artists.map((a) => ({
                id: a.id,
                name: a.name,
                type: 'artist' as const,
                subtitle: (a.genres as string[])?.slice(0, 2).join(', ') || 'Artist',
              })),
            ]);
          }
        } catch {
          // Artist search failure is non-critical — continue with event results
        }

        if (!controller.signal.aborted) {
          setNoResults((prev) => prev && results.length === 0);
          setIsSearching(false);
        }
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Aborted by new keystroke — do nothing, new search handles state
          // Only show "no results" if aborted by our 10s auto-timeout
          if (controller === abortRef.current) {
            // This controller is still the active one → it was our timeout
            setIsSearching(false);
            setNoResults(true);
          }
          return;
        }
        console.error('[RegisterFlow] Search error:', err);
        setSearchResults([]);
        setNoResults(true);
        setIsSearching(false);
      }
    }, 1200);
  }

  function handleResultSelect(result: SearchResult) {
    // Close dropdown and show selection immediately
    setSearchResults([]);
    setSearchQuery(result.name);
    setIsSearching(false);

    if (result.type === 'event') {
      const unified = result.unified;
      if (!unified) return;

      // Local event already in DB — link directly
      if (unified.source === 'local' && unified.local_event_id) {
        setValue('globalEventId', unified.local_event_id);
        setIsGlobalEvent(true);
        setPendingUnified(null);
      } else {
        // External event — defer import to final submit
        setPendingUnified(unified);
        setIsGlobalEvent(true);
      }

      // Fill form instantly from in-memory data (no DB call)
      setValue('name', unified.name);
      setValue('date', unified.date);
      setValue('city', unified.city ?? '');
      setValue('eventType', unified.event_type as EventType);
      setSelectedEventType(unified.event_type as EventType);

      // For local events, load real artist IDs directly from DB (with images already cached)
      if (unified.source === 'local' && unified.local_event_id) {
        // Show sorted placeholder artists immediately while DB loads
        if (unified.artists.length > 0) {
          const sorted = [...unified.artists].sort((a, b) => a.name.localeCompare(b.name));
          const options: ArtistOption[] = sorted.map((a, i) => ({
            id: `ext-${i}`,
            name: a.name,
            imageUrl: a.image_url,
            genres: [],
          }));
          setAvailableArtists(options);
          setValue('artistIds', options.map((a) => a.id));
        }

        // Replace with real DB artists (includes image_url and genres)
        supabase
          .from('global_event_artists')
          .select('artist_id, artists:artist_id (id, name, image_url, genres)')
          .eq('global_event_id', unified.local_event_id)
          .order('billing_order', { ascending: true })
          .then(({ data: eventArtists }) => {
            if (eventArtists && eventArtists.length > 0) {
              // Deduplicate by artist ID AND name
              const seenIds = new Set<string>();
              const seenNames = new Set<string>();
              const real = (eventArtists as unknown as Array<{ artist_id: string; artists: { id: string; name: string; image_url: string | null; genres: string[] } }>)
                .filter((ea) => {
                  const name = ea.artists.name.toLowerCase();
                  if (seenIds.has(ea.artist_id) || seenNames.has(name)) return false;
                  seenIds.add(ea.artist_id);
                  seenNames.add(name);
                  return true;
                })
                .map((ea) => ({
                  id: ea.artists.id,
                  name: ea.artists.name,
                  imageUrl: ea.artists.image_url,
                  genres: ea.artists.genres ?? [],
                }));
              real.sort((a, b) => a.name.localeCompare(b.name));
              setAvailableArtists(real);
              setValue('artistIds', real.map((a) => a.id));

              // Resolve missing images only for artists without one (throttled)
              const needsImage = real.filter((a) => !a.imageUrl);
              if (needsImage.length > 0) {
                (async () => {
                  const BATCH = 10;
                  for (let i = 0; i < needsImage.length; i += BATCH) {
                    const batch = needsImage.slice(i, i + BATCH);
                    await Promise.allSettled(
                      batch.map(async (opt) => {
                        try {
                          const params = new URLSearchParams({ name: opt.name });
                          const r = await fetch(`/api/artists/image?${params}`);
                          const data: { imageUrl?: string | null; genres?: string[] } = await r.json();
                          if (data.imageUrl) {
                            setAvailableArtists((prev) =>
                              prev.map((a) => a.id === opt.id ? { ...a, imageUrl: data.imageUrl ?? a.imageUrl } : a)
                            );
                          }
                        } catch { /* non-critical */ }
                      })
                    );
                  }
                })();
              }
            }
          });
      } else if (unified.artists.length > 0) {
        // External events: set artists from search result, resolve images via cascade
        const sorted = [...unified.artists].sort((a, b) => a.name.localeCompare(b.name));
        const options: ArtistOption[] = sorted.map((a, i) => ({
          id: `ext-${i}`,
          name: a.name,
          imageUrl: a.image_url,
          genres: [],
        }));
        setAvailableArtists(options);
        setValue('artistIds', options.map((a) => a.id));

        // Resolve missing images + genres in background (throttled: 5 at a time)
        const needsImage = options.filter((opt) => !opt.imageUrl || opt.genres.length === 0);
        (async () => {
          const BATCH = 5;
          for (let i = 0; i < needsImage.length; i += BATCH) {
            const batch = needsImage.slice(i, i + BATCH);
            await Promise.allSettled(
              batch.map(async (opt) => {
                const artist = sorted.find((a) => a.name === opt.name);
                const params = new URLSearchParams({ name: opt.name });
                if (artist?.mbid) params.set('mbid', artist.mbid);
                try {
                  const r = await fetch(`/api/artists/image?${params}`);
                  const data: { imageUrl?: string | null; genres?: string[] } = await r.json();
                  if (data.imageUrl || data.genres?.length) {
                    setAvailableArtists((prev) =>
                      prev.map((a) =>
                        a.id === opt.id
                          ? { ...a, imageUrl: data.imageUrl ?? a.imageUrl, genres: data.genres?.length ? data.genres : a.genres }
                          : a
                      )
                    );
                  }
                } catch { /* non-critical */ }
              })
            );
          }
        })();
      }
    } else {
      // Artist selected directly — add to artist list (from local DB)
      supabase
        .from('artists')
        .select('id, name, image_url, genres')
        .eq('id', result.id)
        .single()
        .then(({ data: artist }) => {
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
        });
    }
  }

  /** Import an external event into global_events via server-side API (bypasses RLS) */
  async function importExternalEvent(unified: UnifiedResult): Promise<string | null> {
    try {
      const res = await fetch('/api/events/import', {
        method: 'POST',
        signal: AbortSignal.timeout(60000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: unified.source,
          source_id: unified.source_id,
          name: unified.name,
          date: unified.date,
          date_end: unified.date_end,
          city: unified.city,
          country: unified.country,
          event_type: unified.event_type,
          poster_url: unified.poster_url,
          lat: unified.lat,
          lng: unified.lng,
          artists: unified.artists.map((a) => {
            // Merge image resolved by cascade during Step 2
            const uiArtist = availableArtists.find(
              (ua) => ua.name.toLowerCase() === a.name.toLowerCase()
            );
            return {
              ...a,
              image_url: uiArtist?.imageUrl ?? a.image_url,
              genres: uiArtist?.genres?.length ? uiArtist.genres : undefined,
            };
          }),
        }),
      });

      if (!res.ok) {
        console.error('Import failed:', res.status);
        return null;
      }

      const data = await res.json() as { globalEventId?: string };
      return data.globalEventId ?? null;
    } catch (err) {
      console.error('Error importing external event:', err);
      return null;
    }
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
    setPendingUnified(null);
    setSelectedEventType('concert');
    setDuplicateEvent(null);
    setSubmitSuccess(false);
    setSearchError(false);
    setNoResults(false);
  }

  const isFestival = selectedEventType === 'festival';

  async function onFormSubmit(data: RegisterFormData) {
    if (!user) return;

    try {
      // Ensure we have a valid session before any DB writes
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Try refreshing
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed.session) {
          toast({ title: tError('title'), description: 'Sesión expirada. Recarga la página.', variant: 'destructive' });
          return;
        }
      }

      let globalEventId = data.globalEventId;

      // If there's a pending external event, import it now (deferred from selection)
      if (pendingUnified && !globalEventId) {
        console.log('[submit] 2. Importing external event...');
        const imported = await importExternalEvent(pendingUnified);
        console.log('[submit] 2. Import done:', imported);
        if (imported) {
          globalEventId = imported;
        }
      }

      // Check for duplicate registration
      if (globalEventId) {
        console.log('[submit] 3. Checking duplicates...');
        const { data: existing } = await supabase
          .from('user_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('global_event_id', globalEventId)
          .maybeSingle();

        if (existing) {
          setDuplicateEvent({ id: existing.id, name: data.name });
          return;
        }
      }

      console.log('[submit] 4. Creating user_event...');
      const { data: userEvent, error: eventError } = await supabase
        .from('user_events')
        .insert({
          user_id: user.id,
          global_event_id: globalEventId ?? null,
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
        console.error('[submit] 4. FAILED:', eventError);
        toast({ title: tError('title'), description: tError('description'), variant: 'destructive' });
        return;
      }
      console.log('[submit] 4. Created:', userEvent.id);

      // Link artists (use IDs from imported event if available, skip temp IDs, deduplicate)
      const realArtistIds = [...new Set(data.artistIds.filter((id) => !id.startsWith('ext-')))];
      console.log('[submit] 5. Linking artists, real IDs:', realArtistIds.length);

      if (realArtistIds.length > 0) {
        // Insert in chunks to avoid payload limits
        const CHUNK_SIZE = 50;
        for (let i = 0; i < realArtistIds.length; i += CHUNK_SIZE) {
          const chunk = realArtistIds.slice(i, i + CHUNK_SIZE);
          const artistLinks = chunk.map((artistId) => ({
            user_event_id: userEvent.id,
            artist_id: artistId,
            user_id: user.id,
          }));

          const { error: artistError } = await supabase
            .from('user_event_artists')
            .insert(artistLinks);

          if (artistError) {
            console.error(`[submit] 5. Artist link error (chunk ${i}):`, artistError);
          }
        }
      }

      // If we imported a global event, load its real artist IDs and link them
      if (globalEventId && pendingUnified) {
        console.log('[submit] 6. Loading global_event_artists...');
        const { data: eventArtists } = await supabase
          .from('global_event_artists')
          .select('artist_id')
          .eq('global_event_id', globalEventId);

        console.log('[submit] 6. Found:', eventArtists?.length);
        if (eventArtists && eventArtists.length > 0) {
          const importedLinks = eventArtists
            .filter((ea) => !realArtistIds.includes(ea.artist_id))
            .map((ea) => ({
              user_event_id: userEvent.id,
              artist_id: ea.artist_id,
              user_id: user.id,
            }));

          if (importedLinks.length > 0) {
            console.log('[submit] 6. Inserting', importedLinks.length, 'artist links...');
            await supabase.from('user_event_artists').insert(importedLinks);
          }
        }
      }

      console.log('[submit] 7. DONE — showing success');
      setPendingUnified(null);
      setSubmitSuccess(true);

      // Invalidate all user data caches so Collection and Stats show new data
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-events'] });
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      revalidateCollection().catch(() => {});
    } catch (err) {
      console.error('[submit] CATCH:', err instanceof Error ? err.message : err, err);
      toast({ title: tError('title'), description: tError('description'), variant: 'destructive' });
    }
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
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className={cn('pl-10', searchError && 'border-red-500 focus:border-red-500 focus:ring-red-500')}
                />
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {searchResults.map((result) => {
                      const sourceBadge = result.unified?.source;
                      const badgeColors: Record<string, string> = {
                        local: 'bg-primary/20 text-primary',
                        setlistfm: 'bg-emerald-500/20 text-emerald-600',
                        bandsintown: 'bg-cyan-500/20 text-cyan-600',
                        musicbrainz: 'bg-amber-500/20 text-amber-600',
                      };
                      const badgeLabel: Record<string, string> = {
                        local: 'Encore',
                        setlistfm: 'Setlist',
                        bandsintown: 'BIT',
                        musicbrainz: 'MB',
                      };

                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent"
                          onClick={() => handleResultSelect(result)}
                        >
                          <span className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                            sourceBadge ? badgeColors[sourceBadge] : (result.type === 'event' ? 'bg-primary/20 text-primary' : 'bg-accent text-accent-foreground')
                          )}>
                            {sourceBadge ? badgeLabel[sourceBadge] : (result.type === 'event' ? t('resultTypeEvent') : t('resultTypeArtist'))}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium line-clamp-1">{result.name}</span>
                            {result.subtitle && (
                              <span className="block text-muted-foreground text-xs line-clamp-1">
                                {result.subtitle}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {noResults && !isSearching && searchQuery.length >= 4 && searchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border bg-popover p-4 shadow-lg">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('noResults')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('noResultsHint')}
                    </p>
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
                    disabled={isGlobalEvent && !!watch('city')}
                    className={isGlobalEvent && !!watch('city') ? 'opacity-60' : ''}
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
                  onSelectAll={(ids) => {
                    const updated = [...new Set([...selectedArtistIds, ...ids])];
                    setValue('artistIds', updated);
                  }}
                  onDeselectAll={(ids) => {
                    const idSet = new Set(ids);
                    setValue('artistIds', selectedArtistIds.filter(id => !idSet.has(id)));
                  }}
                  selectable
                  selectAllLabel={t('selectAll')}
                  deselectAllLabel={t('deselectAll')}
                  filterPlaceholder={t('filterArtists')}
                  selectedCountLabel={(count) => t('selectedCount', { count })}
                />
              ) : (
                <div className="rounded-lg bg-muted p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('noArtistsFound')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('noArtistsHint')}
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
                {watch('city') && <p><span className="font-medium">{t('eventCity')}:</span> {watch('city')}</p>}
                <p><span className="font-medium">{t('eventType')}:</span> {tTypes(watch('eventType'))}</p>
                <p><span className="font-medium">{t('artistsLabel')}:</span> {t('selectedCount', { count: selectedArtistIds.length })}</p>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <Label>{t('rating')}</Label>
                <Controller
                  control={control}
                  name="rating"
                  render={({ field }) => (
                    <div className="flex gap-1" role="radiogroup" aria-label={t('rating')}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`${star} / 5`}
                          aria-pressed={field.value === star}
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
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('mood')}>
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
