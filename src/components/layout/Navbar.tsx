'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Compass,
  Library,
  BarChart3,
  PlusCircle,
  Settings,
  LogOut,
  Globe,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/hooks/useSupabase';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavLink {
  href: string;
  labelKey: 'discover' | 'collection' | 'stats' | 'register';
  icon: React.ElementType;
}

const navLinks: NavLink[] = [
  { href: '/collection', labelKey: 'collection', icon: Library },
  { href: '/register', labelKey: 'register', icon: PlusCircle },
  { href: '/stats', labelKey: 'stats', icon: BarChart3 },
];

interface NavbarProps {
  user?: {
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useSupabase();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push(`/${locale}`);
    router.refresh();
  }

  const otherLocale = locale === 'es' ? 'en' : 'es';
  const queryString = searchParams.toString();
  const localeSwitchHref = `/${otherLocale}${pathname.replace(`/${locale}`, '')}${queryString ? `?${queryString}` : ''}`;

  function isActive(href: string): boolean {
    const localePath = `/${locale}${href}`;
    return pathname === localePath || pathname.startsWith(`${localePath}/`);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-encore-navy/95 backdrop-blur supports-[backdrop-filter]:bg-encore-navy/80">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-primary">
            ENCORE
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link key={link.href} href={`/${locale}${link.href}`}>
                <Button
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-2 text-white/70 hover:text-white',
                    active && 'text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(link.labelKey)}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right side: language toggle + user avatar */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <Link href={localeSwitchHref}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-white/70 hover:text-white"
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">
                {otherLocale}
              </span>
            </Button>
          </Link>

          {/* User dropdown */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    {user.avatarUrl && (
                      <AvatarImage
                        src={user.avatarUrl}
                        alt={user.displayName ?? 'User'}
                      />
                    )}
                    <AvatarFallback className="bg-primary text-white text-xs">
                      {user.displayName
                        ? user.displayName.charAt(0).toUpperCase()
                        : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2 text-sm font-medium text-foreground">
                  {user.displayName ?? 'Usuario'}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={`/${locale}/collection`}
                    className="flex items-center gap-2"
                  >
                    <Library className="h-4 w-4" />
                    {t('collection')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/${locale}/stats`}
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    {t('stats')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/${locale}/settings`}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    {t('settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleLogout();
                  }}
                  className="flex items-center gap-2 text-red-500 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href={`/${locale}/login`}>
              <Button variant="default" size="sm">
                {t('login')}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
