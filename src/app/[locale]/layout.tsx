import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/lib/i18n/config';
import { QueryProvider } from '@/app/providers';
import { UserProvider } from '@/providers/UserProvider';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Encore - Tu historia musical en vivo',
  description:
    'Registra los conciertos y festivales que has vivido. Descubre eventos, colecciona recuerdos y comparte tu historia musical.',
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: LocaleLayoutProps) {
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans dark`}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <UserProvider>{children}</UserProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
