'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useUser } from '@/hooks/useUser';
import { useSupabase } from '@/hooks/useSupabase';
import { profileSchema, passwordChangeSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, Music, Globe } from 'lucide-react';

const GENRE_OPTIONS = [
  'rock',
  'pop',
  'electronic',
  'hip-hop',
  'r&b',
  'jazz',
  'blues',
  'metal',
  'punk',
  'folk',
  'country',
  'latin',
  'reggae',
  'classical',
  'indie rock',
  'alt-rock',
  'synth-pop',
  'k-pop',
  'techno',
  'house',
  'soul',
  'funk',
] as const;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const router = useRouter();
  const { user, profile, refreshProfile } = useUser();
  const supabase = useSupabase();

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setCity(profile.city ?? '');
      setCountry(profile.country ?? '');
      setSelectedGenres(profile.preferred_genres ?? []);
    }
  }, [profile]);

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre]
    );
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const parsed = profileSchema.safeParse({
      display_name: displayName || null,
      city: city || null,
      country: country || null,
      preferred_genres: selectedGenres,
    });

    if (!parsed.success) {
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    await supabase
      .from('profiles')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    await refreshProfile();
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    const parsed = passwordChangeSchema.safeParse({ newPassword, confirmNewPassword });
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      if (firstError?.path.includes('confirmNewPassword')) {
        setPasswordError(t('passwordMismatch'));
      } else {
        setPasswordError(firstError?.message ?? 'Invalid input');
      }
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  }

  function handleLanguageChange(newLocale: string) {
    const currentPath = window.location.pathname;
    const newPath = currentPath.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      {/* Profile form */}
      <form onSubmit={handleSaveProfile} className="mt-8 space-y-6">
        <section>
          <h2 className="text-lg font-semibold">{t('profileSection')}</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="displayName"
                className="text-sm font-medium"
              >
                {t('displayName')}
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('displayNamePlaceholder')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="city" className="text-sm font-medium">
                  {t('city')}
                </label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('cityPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="country" className="text-sm font-medium">
                  {t('country')}
                </label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder={t('countryPlaceholder')}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Genres */}
        <section>
          <h2 className="text-lg font-semibold">{t('preferredGenres')}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((genre) => {
              const isSelected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
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
        </section>

        {/* Language */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5" />
            {t('language')}
          </h2>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => handleLanguageChange('es')}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                locale === 'es'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              Espanol
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                locale === 'en'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              English
            </button>
          </div>
        </section>

        {/* Spotify connection */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Music className="h-5 w-5" />
            {t('spotifyConnection')}
          </h2>
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {t('spotifyNotConnected')}
            </p>
            <Button type="button" variant="secondary" className="mt-3" size="sm">
              {t('connectSpotify')}
            </Button>
          </div>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('saveChanges')}
          </Button>
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-500">
              <Check className="h-4 w-4" />
              {t('saved')}
            </span>
          )}
        </div>
      </form>

      {/* Account section */}
      <section className="mt-12 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">{t('accountSection')}</h2>
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('email')}: <span className="font-medium text-foreground">{user?.email}</span>
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
          <h3 className="font-medium">{t('changePassword')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                {t('newPassword')}
              </label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="confirmNewPassword"
                className="text-sm font-medium"
              >
                {t('confirmNewPassword')}
              </label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          </div>

          {passwordError && (
            <p className="text-sm text-destructive">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="flex items-center gap-1 text-sm text-green-500">
              <Check className="h-4 w-4" />
              {t('passwordUpdated')}
            </p>
          )}

          <Button type="submit" variant="outline" size="sm">
            {t('updatePassword')}
          </Button>
        </form>
      </section>
    </div>
  );
}
