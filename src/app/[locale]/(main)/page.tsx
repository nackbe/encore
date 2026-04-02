import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Music, Disc3, BarChart3, MapPin } from 'lucide-react';

interface HomePageProps {
  params: { locale: string };
}

export default async function HomePage({ params: { locale } }: HomePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(`/${locale}/discover`);
  }

  const t = await getTranslations('landing');

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Music className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl">
          Encore
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          {t('heroDescription')}
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href={`/${locale}/signup`}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {t('getStarted')}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {t('signIn')}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-20 sm:grid-cols-3">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center">
          <Disc3 className="h-10 w-10 text-primary" />
          <h3 className="mt-4 text-lg font-semibold">{t('featureCollectTitle')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('featureCollectDescription')}
          </p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center">
          <BarChart3 className="h-10 w-10 text-primary" />
          <h3 className="mt-4 text-lg font-semibold">{t('featureStatsTitle')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('featureStatsDescription')}
          </p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center">
          <MapPin className="h-10 w-10 text-primary" />
          <h3 className="mt-4 text-lg font-semibold">{t('featureDiscoverTitle')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('featureDiscoverDescription')}
          </p>
        </div>
      </section>
    </div>
  );
}
