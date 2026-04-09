import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Music, Disc3, BarChart3, Share2 } from 'lucide-react';

interface HomePageProps {
  params: { locale: string };
}

export default async function HomePage({ params: { locale } }: HomePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(`/${locale}/collection`);
  }

  const t = await getTranslations('landing');

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4">
      {/* Hero + Features in one centered block */}
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Music className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Encore
        </h1>
        <p className="mt-3 max-w-md text-base text-muted-foreground">
          {t('heroDescription')}
        </p>
        <div className="mt-6 flex gap-3">
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

        {/* Features */}
        <div className="mt-14 grid w-full gap-4 sm:grid-cols-3">
          <div className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center">
            <Disc3 className="h-8 w-8 text-primary" />
            <h3 className="mt-3 text-sm font-semibold">{t('featureCollectTitle')}</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('featureCollectDescription')}
            </p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h3 className="mt-3 text-sm font-semibold">{t('featureStatsTitle')}</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('featureStatsDescription')}
            </p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center">
            <Share2 className="h-8 w-8 text-primary" />
            <h3 className="mt-3 text-sm font-semibold">{t('featureShareTitle')}</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('featureShareDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
