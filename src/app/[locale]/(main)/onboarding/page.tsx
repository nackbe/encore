'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useUser } from '@/hooks/useUser';
import { useSupabase } from '@/hooks/useSupabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MapPin,
  Music,
  Users,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';

const GENRE_OPTIONS = [
  'rock', 'pop', 'electronic', 'hip-hop', 'r&b', 'jazz', 'blues',
  'metal', 'punk', 'folk', 'latin', 'reggae', 'indie rock', 'alt-rock',
  'synth-pop', 'techno', 'house', 'soul', 'funk', 'reggaeton',
] as const;

interface SuggestedArtist {
  id: string;
  name: string;
  genres: string[];
  image_url: string | null;
}

const STEPS = [
  { icon: MapPin, key: 'city' },
  { icon: Music, key: 'genres' },
  { icon: Users, key: 'followArtists' },
] as const;

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();
  const { user, refreshProfile } = useUser();
  const supabase = useSupabase();

  const [currentStep, setCurrentStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  // Step 1: City
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Step 2: Genres
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Step 3: Suggested artists
  const [suggestedArtists, setSuggestedArtists] = useState<SuggestedArtist[]>([]);
  const [followedArtistIds, setFollowedArtistIds] = useState<string[]>([]);

  // Fetch suggested artists when reaching step 3
  useEffect(() => {
    if (currentStep === 2) {
      fetchSuggestedArtists();
    }
  }, [currentStep]);

  async function fetchSuggestedArtists() {
    if (selectedGenres.length > 0) {
      // Fetch artists matching selected genres, with images, ordered by popularity
      const { data } = await supabase
        .from('artists')
        .select('id, name, genres, image_url')
        .eq('is_active', true)
        .not('image_url', 'is', null)
        .overlaps('genres', selectedGenres)
        .order('spotify_popularity', { ascending: false })
        .limit(50) as { data: SuggestedArtist[] | null };

      if (data && data.length > 0) {
        // Score by how many selected genres match, then sort by score desc
        const scored = data.map((a) => {
          const matchCount = a.genres?.filter((g) =>
            selectedGenres.some((sg) => g.toLowerCase().includes(sg.toLowerCase()))
          ).length ?? 0;
          return { ...a, score: matchCount };
        }).sort((a, b) => b.score - a.score);
        setSuggestedArtists(scored.slice(0, 20));
        return;
      }
    }

    // Fallback: top artists with images by popularity
    const { data } = await supabase
      .from('artists')
      .select('id, name, genres, image_url')
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .order('spotify_popularity', { ascending: false })
      .limit(20) as { data: SuggestedArtist[] | null };

    if (data) {
      setSuggestedArtists(data);
    }
  }

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  function toggleArtist(artistId: string) {
    setFollowedArtistIds((prev) =>
      prev.includes(artistId)
        ? prev.filter((id) => id !== artistId)
        : [...prev, artistId]
    );
  }

  async function handleFinish() {
    if (!user) {
      // If no user yet (email confirmation pending), just redirect
      router.push(`/${locale}/collection`);
      return;
    }

    setIsFinishing(true);

    // Update profile with city, country, genres, mark onboarding complete
    await supabase
      .from('profiles')
      .update({
        city: city || null,
        country: country || null,
        preferred_genres: selectedGenres,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Follow artists
    if (followedArtistIds.length > 0) {
      const follows = followedArtistIds.map((artistId) => ({
        user_id: user.id,
        artist_id: artistId,
      }));
      await supabase.from('user_followed_artists').insert(follows);
    }

    await refreshProfile();
    setIsFinishing(false);
    router.push(`/${locale}/collection`);
  }

  async function handleSkipAll() {
    if (user) {
      await supabase
        .from('profiles')
        .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }
    router.push(`/${locale}/collection`);
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col px-4 py-10">
      {/* Skip all */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleSkipAll} className="text-muted-foreground">
          {t('skip')} →
        </Button>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => (
          <div
            key={step.key}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              index === currentStep
                ? 'bg-primary text-primary-foreground'
                : index < currentStep
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {index < currentStep ? (
              <Check className="h-5 w-5" />
            ) : (
              <step.icon className="h-5 w-5" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="mt-10 flex-1">
        {/* Step 1: City */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">{t('cityTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('cityDescription')}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="onb-city" className="text-sm font-medium">
                  {t('cityLabel')}
                </label>
                <Input
                  id="onb-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('cityPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-country" className="text-sm font-medium">
                  {t('countryLabel')}
                </label>
                <Input
                  id="onb-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder={t('countryPlaceholder')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Genres */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">{t('genresTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('genresDescription')}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {GENRE_OPTIONS.map((genre) => {
                const isSelected = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm capitalize transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Follow artists */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">{t('followArtistsTitle')}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('followArtistsDescription')}
              </p>
            </div>
            {suggestedArtists.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedArtists.map((artist) => {
                  const isFollowed = followedArtistIds.includes(artist.id);
                  return (
                    <button
                      key={artist.id}
                      type="button"
                      onClick={() => toggleArtist(artist.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                        isFollowed
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {isFollowed && <Check className="h-3 w-3" />}
                      <Music className="h-3 w-3" />
                      {artist.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {followedArtistIds.length > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {followedArtistIds.length} artista{followedArtistIds.length !== 1 ? 's' : ''} seleccionado{followedArtistIds.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={prevStep}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t('back')}
        </Button>

        <span className="text-sm text-muted-foreground">
          {currentStep + 1} / {STEPS.length}
        </span>

        <Button type="button" onClick={nextStep} disabled={isFinishing}>
          {isFinishing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {currentStep === STEPS.length - 1 ? t('finish') : t('next')}
          {currentStep < STEPS.length - 1 && (
            <ChevronRight className="ml-1 h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
