/**
 * Wikipedia Category Crawler
 *
 * Recursively crawls Wikipedia categories to discover festival article pages.
 * Starts from root categories defined in wiki-entry-points.ts and follows
 * subcategories up to a configurable depth.
 *
 * Output: Array of FestivalPage objects (title + lang + categories).
 */

import { API_URLS } from '../config/source-config';
import type { WikiEntryPoint } from '../config/wiki-entry-points';
import { rateLimitedFetch } from '../utils/rate-limiter';
import { withRetry } from '../utils/retry';
import { createLogger, createProgress } from '../utils/logger';

const log = createLogger('wiki-crawler');

// ─── Types ───────────────────────────────────────────────────

export interface FestivalPage {
  /** Wikipedia article title */
  title: string;
  /** Language code */
  lang: string;
  /** Page ID */
  pageId: number;
  /** Categories this page was found in */
  foundInCategories: string[];
}

interface CMResponse {
  query: {
    categorymembers: Array<{
      pageid: number;
      ns: number; // 0 = article, 14 = category
      title: string;
    }>;
  };
  continue?: {
    cmcontinue: string;
  };
}

// ─── API Helper ──────────────────────────────────────────────

function getApiUrl(lang: string): string {
  if (lang === 'es') return API_URLS.wikipediaEs;
  if (lang === 'pt') return API_URLS.wikipediaPt;
  return API_URLS.wikipedia;
}

/**
 * Fetch all members of a Wikipedia category (handles pagination).
 * Returns both article pages (ns=0) and subcategories (ns=14).
 */
async function fetchCategoryMembers(
  category: string,
  lang: string
): Promise<{ pages: Array<{ pageId: number; title: string }>; subcats: string[] }> {
  const apiUrl = getApiUrl(lang);
  const pages: Array<{ pageId: number; title: string }> = [];
  const subcats: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmtype: 'page|subcat',
      cmlimit: '500',
      format: 'json',
    });
    if (cmcontinue) params.set('cmcontinue', cmcontinue);

    const data = await withRetry(
      async () => {
        const res = await rateLimitedFetch('wikipedia', `${apiUrl}?${params}`);
        if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
        return (await res.json()) as CMResponse;
      },
      { source: 'wikipedia' }
    );

    for (const member of data.query.categorymembers) {
      if (member.ns === 0) {
        pages.push({ pageId: member.pageid, title: member.title });
      } else if (member.ns === 14) {
        // Strip "Category:" prefix
        const catName = member.title.replace(/^Category:/, '').replace(/^Categoría:/, '').replace(/^Categoria:/, '');
        subcats.push(catName);
      }
    }

    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);

  return { pages, subcats };
}

// ─── Filters ─────────────────────────────────────────────────

/** Categories that are NOT about specific festivals — skip to save time */
const SKIP_CATEGORIES = new Set([
  // Meta/maintenance categories
  'music_festival_stubs',
  'articles_needing_additional_references',
  'all_stub_articles',
  'webarchive_template_wayback_links',
  // Non-festival categories that appear as subcats
  'concert_tours',
  'music_venues',
  'record_labels',
  'music_organizations',
  'music_awards',
  'music_competitions',
  'music_television_series',
  'music_documentaries',
  'film_festivals',
  'theatre_festivals',
  'literary_festivals',
  'food_festivals',
  'cultural_festivals',
  'religious_festivals',
  'harvest_festivals',
]);

function shouldSkipCategory(catName: string): boolean {
  const normalized = catName.toLowerCase().replace(/\s+/g, '_');
  for (const skip of SKIP_CATEGORIES) {
    if (normalized.includes(skip)) return true;
  }
  return false;
}

/** Filter out pages that are clearly not festival articles */
function isFestivalPage(title: string): boolean {
  const lower = title.toLowerCase();
  // Skip disambiguation pages, lists that aren't festivals, etc.
  if (lower.includes('(disambiguation)')) return false;
  if (lower.startsWith('list of') && !lower.includes('festival')) return false;
  if (lower.startsWith('category:')) return false;
  return true;
}

// ─── Recursive Crawler ──────────────────────────────────────

/**
 * Crawl a single entry point: recursively discover all festival pages
 * within the category tree up to maxDepth.
 */
async function crawlEntryPoint(
  entryPoint: WikiEntryPoint,
  visitedCategories: Set<string>,
  allPages: Map<string, FestivalPage>
): Promise<void> {
  const queue: Array<{ category: string; depth: number }> = [
    { category: entryPoint.category, depth: 0 },
  ];

  while (queue.length > 0) {
    const { category, depth } = queue.shift()!;

    // Skip if already visited or too deep
    const catKey = `${entryPoint.lang}:${category}`;
    if (visitedCategories.has(catKey)) continue;
    if (depth > entryPoint.maxDepth) continue;
    if (shouldSkipCategory(category)) {
      log.debug(`Skip category: ${category}`);
      continue;
    }

    visitedCategories.add(catKey);
    log.debug(`Crawling [${entryPoint.lang}] ${category} (depth ${depth})`);

    try {
      const { pages, subcats } = await fetchCategoryMembers(category, entryPoint.lang);

      // Add discovered pages
      for (const page of pages) {
        if (!isFestivalPage(page.title)) continue;

        const pageKey = `${entryPoint.lang}:${page.title}`;
        const existing = allPages.get(pageKey);
        if (existing) {
          existing.foundInCategories.push(category);
        } else {
          allPages.set(pageKey, {
            title: page.title,
            lang: entryPoint.lang,
            pageId: page.pageId,
            foundInCategories: [category],
          });
        }
      }

      // Queue subcategories for next depth level
      for (const subcat of subcats) {
        queue.push({ category: subcat, depth: depth + 1 });
      }
    } catch (err) {
      log.warn(`Failed to crawl ${category}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ─── Main Export ─────────────────────────────────────────────

/**
 * Crawl all entry points and return a deduplicated list of festival pages.
 */
export async function crawlAllFestivals(
  entryPoints: WikiEntryPoint[]
): Promise<FestivalPage[]> {
  const visitedCategories = new Set<string>();
  const allPages = new Map<string, FestivalPage>();
  const progress = createProgress('wiki-crawler', entryPoints.length);

  log.info(`Starting crawl of ${entryPoints.length} entry points`);

  for (const ep of entryPoints) {
    log.info(`[${ep.lang}] ${ep.label ?? ep.category} (maxDepth: ${ep.maxDepth})`);
    await crawlEntryPoint(ep, visitedCategories, allPages);
    progress.tick(ep.label ?? ep.category);
  }

  progress.summary();
  log.info(`Categories visited: ${visitedCategories.size}`);
  log.info(`Unique festival pages: ${allPages.size}`);

  return Array.from(allPages.values());
}
