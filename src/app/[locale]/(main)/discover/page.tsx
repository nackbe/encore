import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { DiscoverFeed } from '@/components/discover/DiscoverFeed';

export default async function DiscoverPage() {
  const t = await getTranslations('discover');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch user profile + wishlist + collection genres in parallel
  let userCity = '';
  let userCountry = '';
  let userGenres: string[] = [];
  let wishlistedIds: string[] = [];

  if (user) {
    const [profileResult, wishlistResult, collectionResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('city, country, preferred_genres')
        .eq('id', user.id)
        .single() as unknown as Promise<{ data: { city: string | null; country: string | null; preferred_genres: string[] | null } | null }>,
      supabase
        .from('user_wishlist')
        .select('global_event_id')
        .eq('user_id', user.id) as unknown as Promise<{ data: Array<{ global_event_id: string }> | null }>,
      supabase
        .from('user_event_artists')
        .select('artists:artist_id (genres)')
        .eq('user_id', user.id) as unknown as Promise<{ data: Array<{ artists: { genres: string[] | null } }> | null }>,
    ]);

    userCity = profileResult.data?.city ?? '';
    userCountry = profileResult.data?.country ?? '';
    wishlistedIds = wishlistResult.data?.map((w) => w.global_event_id) ?? [];

    const genreSet = new Set<string>();
    profileResult.data?.preferred_genres?.forEach((g) => genreSet.add(g));
    collectionResult.data?.forEach((ea) => {
      ea.artists?.genres?.forEach((g) => genreSet.add(g));
    });
    userGenres = Array.from(genreSet);
  }

  // Fetch available cities and countries for the location selector
  const { data: locations } = await supabase
    .from('global_events')
    .select('city, country')
    .gte('date', new Date().toISOString().split('T')[0]) as unknown as {
      data: Array<{ city: string | null; country: string | null }> | null;
    };

  const citySet = new Set<string>();
  const countrySet = new Set<string>();
  locations?.forEach((l) => {
    if (l.city) citySet.add(l.city);
    if (l.country) countrySet.add(l.country);
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {t('title')}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('subtitle')}
      </p>
      <div className="mt-6">
        <DiscoverFeed
          userCity={userCity}
          userCountry={userCountry}
          userGenres={userGenres}
          wishlistedIds={wishlistedIds}
          availableCities={Array.from(citySet).sort()}
          availableCountries={Array.from(countrySet).sort()}
        />
      </div>
    </div>
  );
}
