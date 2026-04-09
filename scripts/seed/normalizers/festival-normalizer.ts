/**
 * Festival name normalizer.
 *
 * Filters out individual edition pages (e.g., "Lollapalooza 2019")
 * and normalizes festival names for deduplication across languages.
 */

import type { FestivalPage } from '../crawlers/wikipedia-crawler';
import { createLogger } from '../utils/logger';

const log = createLogger('normalizer');

// ─── Individual Edition Detection ────────────────────────────

/**
 * Detect pages that are about a specific year/edition of a festival
 * rather than the festival itself.
 * e.g., "Lollapalooza 2019", "Rock al Parque 2018",
 *        "XLIX Festival Internacional de la Cultura de Boyacá 2022"
 */
const YEAR_SUFFIX_RE = /\b(19|20)\d{2}$/;
const ROMAN_PREFIX_RE = /^[IVXLCDM]+\s+/;
const EDITION_PATTERNS = [
  /\b\d{1,3}(st|nd|rd|th)\s+(edition|annual)/i,
  /\bedición\b/i,
  /\bedição\b/i,
];

export function isEditionPage(title: string): boolean {
  // "Festival Boyacá 2019" — year at end
  if (YEAR_SUFFIX_RE.test(title.trim())) return true;
  // "XLIX Festival Internacional..." — Roman numeral prefix
  if (ROMAN_PREFIX_RE.test(title.trim())) return true;
  // "3rd edition", "edición"
  if (EDITION_PATTERNS.some((re) => re.test(title))) return true;
  return false;
}

// ─── Name Normalization ──────────────────────────────────────

/**
 * Normalize a festival name for deduplication.
 * Removes language-specific suffixes, parenthetical disambiguators, etc.
 */
export function normalizeFestivalName(title: string): string {
  let name = title;

  // Remove parenthetical disambiguators: "Rock al Parque (Colombia)" → "Rock al Parque"
  name = name.replace(/\s*\([^)]*\)\s*$/, '');

  // Remove "Festival" prefix/suffix variations for comparison
  // (keep in actual title, only used for matching)
  name = name.trim();

  // Normalize unicode
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return name.toLowerCase().trim();
}

// ─── Cross-Language Dedup ────────────────────────────────────

export interface DeduplicatedFestival {
  /** Canonical name (prefer English, fallback to first found) */
  canonicalTitle: string;
  /** All language variants */
  variants: Array<{ title: string; lang: string; pageId: number }>;
  /** Union of all categories across languages */
  allCategories: string[];
  /** Normalized name for matching */
  normalizedName: string;
}

/**
 * Deduplicate festivals across languages.
 * Groups pages that are likely the same festival (same normalized name).
 */
export function deduplicateFestivals(pages: FestivalPage[]): DeduplicatedFestival[] {
  // First, filter out edition pages
  const filtered = pages.filter((p) => {
    if (isEditionPage(p.title)) {
      log.debug(`Skip edition: ${p.title}`);
      return false;
    }
    return true;
  });
  log.info(`Filtered ${pages.length - filtered.length} edition pages, ${filtered.length} remaining`);

  // Group by normalized name
  const groups = new Map<string, FestivalPage[]>();
  for (const page of filtered) {
    const key = normalizeFestivalName(page.title);
    const group = groups.get(key) ?? [];
    group.push(page);
    groups.set(key, group);
  }

  // Build deduplicated list
  const results: DeduplicatedFestival[] = [];
  for (const [normalizedName, group] of groups) {
    // Prefer English title as canonical
    const enVariant = group.find((p) => p.lang === 'en');
    const canonicalTitle = enVariant?.title ?? group[0].title;

    const allCategories = [...new Set(group.flatMap((p) => p.foundInCategories))];

    results.push({
      canonicalTitle,
      variants: group.map((p) => ({
        title: p.title,
        lang: p.lang,
        pageId: p.pageId,
      })),
      allCategories,
      normalizedName,
    });
  }

  log.info(`Deduplicated: ${filtered.length} pages → ${results.length} unique festivals`);
  return results;
}
