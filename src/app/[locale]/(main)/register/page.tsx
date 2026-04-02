import { getTranslations } from 'next-intl/server';
import { RegisterFlow } from '@/components/events/RegisterFlow';

export default async function RegisterEventPage() {
  const t = await getTranslations('registerEvent');

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {t('title')}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('subtitle')}
      </p>
      <div className="mt-6">
        <RegisterFlow />
      </div>
    </div>
  );
}
