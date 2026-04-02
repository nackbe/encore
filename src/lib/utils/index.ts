import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EventType } from '@/types';

/**
 * Merges class names using clsx and tailwind-merge to handle
 * Tailwind CSS class conflicts correctly.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes text for comparison: lowercases, removes accents/diacritics, and trims.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Formats a date string or Date object to a locale-aware display string.
 */
export function formatDate(
  date: string | Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
}

/**
 * Formats an event date in short form: "15 ene 2025"
 */
export function formatEventDate(date: string | Date, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Formats a date as "month year" for timeline grouping: "Enero 2025"
 */
export function formatMonthYear(date: string | Date, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
}

/**
 * Returns a hex color string for a given music genre.
 * Used for placeholder images and genre badges.
 */
export function getGenrePlaceholderColor(genre: string): string {
  const genreColors: Record<string, string> = {
    rock: '#DC2626',
    'indie rock': '#EF4444',
    'alt-rock': '#F87171',
    alternative: '#F97316',
    pop: '#EC4899',
    'synth-pop': '#F472B6',
    'k-pop': '#FB7185',
    electronic: '#8B5CF6',
    techno: '#7C3AED',
    house: '#A78BFA',
    'hip-hop': '#F59E0B',
    rap: '#FBBF24',
    r_b: '#D97706',
    jazz: '#0891B2',
    blues: '#2563EB',
    classical: '#6366F1',
    metal: '#1F2937',
    punk: '#65A30D',
    folk: '#92400E',
    country: '#CA8A04',
    latin: '#E11D48',
    reggae: '#16A34A',
    soul: '#9333EA',
    funk: '#C026D3',
  };

  const normalizedGenre = genre.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return genreColors[normalizedGenre] ?? '#6B7280';
}

/**
 * Returns a Tailwind CSS color class for a given event type.
 */
export function getEventTypeColor(type: EventType): string {
  const colors: Record<EventType, string> = {
    concert: 'text-blue-500',
    festival: 'text-purple-500',
    club_show: 'text-pink-500',
    theater: 'text-amber-500',
    special: 'text-emerald-500',
  };

  return colors[type];
}
