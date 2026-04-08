'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Compass,
  Library,
  PlusCircle,
  BarChart3,
  User,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface MobileNavLink {
  href: string;
  labelKey: 'discover' | 'collection' | 'register' | 'stats' | 'profile';
  icon: React.ElementType;
  prominent?: boolean;
}

const mobileLinks: MobileNavLink[] = [
  { href: '/collection', labelKey: 'collection', icon: Library },
  { href: '/stats', labelKey: 'stats', icon: BarChart3 },
  { href: '/register', labelKey: 'register', icon: PlusCircle, prominent: true },
  { href: '/settings', labelKey: 'profile', icon: User },
];

export function MobileNav() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();

  function isActive(href: string): boolean {
    const localePath = `/${locale}${href}`;
    return pathname === localePath || pathname.startsWith(`${localePath}/`);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-encore-navy md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);

          if (link.prominent) {
            return (
              <Link
                key={link.href}
                href={`/${locale}${link.href}`}
                className="flex flex-col items-center"
              >
                <div
                  className={cn(
                    '-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg transition-transform',
                    active && 'scale-110 ring-2 ring-secondary'
                  )}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="mt-0.5 text-[10px] font-medium text-primary">
                  {t(link.labelKey)}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={link.href}
              href={`/${locale}${link.href}`}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 transition-colors',
                active ? 'text-primary' : 'text-white/50'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t(link.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
