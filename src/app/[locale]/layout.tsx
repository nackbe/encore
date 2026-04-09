import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/lib/i18n/config';
import { QueryProvider } from '@/app/providers';
import { UserProvider } from '@/providers/UserProvider';
import { Toaster } from '@/components/ui/toaster';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Encore - Tu historia musical en vivo',
    template: '%s | Encore',
  },
  description:
    'Registra los conciertos y festivales que has vivido. Descubre eventos, colecciona recuerdos y comparte tu historia musical.',
  keywords: ['conciertos', 'festivales', 'música en vivo', 'colección', 'estadísticas', 'live music', 'concerts', 'festivals'],
  authors: [{ name: 'Encore' }],
  openGraph: {
    type: 'website',
    siteName: 'Encore',
    title: 'Encore - Tu historia musical en vivo',
    description: 'Registra los conciertos y festivales que has vivido. Colecciona recuerdos y comparte tu historia musical.',
    locale: 'es_LA',
    alternateLocale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Encore - Tu historia musical en vivo',
    description: 'Registra los conciertos y festivales que has vivido. Colecciona recuerdos y comparte tu historia musical.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#D4845A',
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
            <UserProvider>
              {children}
              <Toaster />
            </UserProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
