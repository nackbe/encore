/**
 * Wikipedia Lineup Parser
 *
 * Extracts artist lineups from festival Wikipedia pages.
 * Handles multiple HTML patterns:
 *   - <ul><li><a> lists (Coachella tables, Bonnaroo, early Lollapalooza)
 *   - Comma-separated <a> in <p> (modern Lollapalooza, Rock al Parque)
 *   - <table> with stage columns (Coachella)
 *   - Section headers as years (<h3>/<h4>)
 *   - Bold = headliner, italic = stage name
 *
 * Output: FestivalLineup with per-year artist arrays.
 */

import * as cheerio from 'cheerio';
import type { Element, AnyNode } from 'domhandler';
import { API_URLS } from '../config/source-config';
import { rateLimitedFetch } from '../utils/rate-limiter';
import { withRetry } from '../utils/retry';
import { createLogger } from '../utils/logger';
import { extractInsights, extractLocation, extractLocationFromTitle, extractDate, normalizeLocation, type FestivalInsight, type FestivalLocation } from './wikipedia-insights-extractor';

const log = createLogger('lineup-parser');

// ─── Types ───────────────────────────────────────────────────

export interface ArtistEntry {
  name: string;
  isHeadliner: boolean;
  stage?: string;
  day?: string;
  /** Set time range, e.g. "14:00-15:00" — populated by Clashfinder enrichment */
  setTime?: string;
  /** Regional edition (e.g., "Australia", "Mexico") — for multi-country festivals */
  edition?: string;
}

export interface YearLineup {
  year: number;
  artists: ArtistEntry[];
  /** Regional edition label (e.g., "Lisboa", "Rio de Janeiro") — for multi-city festivals */
  edition?: string;
  /** Per-year location resolved from edition — overrides festival-level location */
  location?: FestivalLocation;
  /** Precise date extracted from Wikipedia (e.g., "2024-06-14") — overrides generic YYYY-01-01 */
  date?: string;
  /** End date for multi-day festivals (e.g., "2024-06-16") */
  dateEnd?: string;
}

export interface FestivalLineup {
  /** Festival title from Wikipedia */
  title: string;
  lang: string;
  pageId: number;
  /** Lineup by year */
  years: YearLineup[];
  /** Source page (may differ from title if redirected to lineup page) */
  sourcePage: string;
  /** Extracted highlights/insights from Wikipedia prose */
  insights?: FestivalInsight[];
  /** Festival poster/logo URL from Wikipedia pageimage */
  posterUrl?: string;
  /** Location extracted from Wikipedia intro prose */
  location?: FestivalLocation;
}

// ─── Wikipedia API Helpers ───────────────────────────────────

interface WikiSection {
  index: string;
  level: string;
  line: string; // section title (may contain HTML tags)
  number: string;
  parentTitle?: string; // injected by findLineupSections for edition detection
}

interface WikiSectionsResponse {
  parse: {
    title: string;
    sections: WikiSection[];
  };
}

interface WikiParseResponse {
  parse: {
    title: string;
    text: { '*': string };
  };
}

function getApiUrl(lang: string): string {
  if (lang === 'es') return API_URLS.wikipediaEs;
  if (lang === 'pt') return API_URLS.wikipediaPt;
  return API_URLS.wikipedia;
}

async function fetchSections(page: string, lang: string): Promise<WikiSection[]> {
  const apiUrl = getApiUrl(lang);
  const params = new URLSearchParams({
    action: 'parse',
    page,
    prop: 'sections',
    redirects: '1',
    format: 'json',
  });

  const data = await withRetry(
    async () => {
      const res = await rateLimitedFetch('wikipedia', `${apiUrl}?${params}`);
      if (!res.ok) throw new Error(`Wikipedia sections API ${res.status}`);
      return (await res.json()) as WikiSectionsResponse;
    },
    { source: 'wikipedia' }
  );

  return data.parse.sections;
}

async function fetchSectionHtml(page: string, sectionIndex: string, lang: string): Promise<string> {
  const apiUrl = getApiUrl(lang);
  const params = new URLSearchParams({
    action: 'parse',
    page,
    prop: 'text',
    section: sectionIndex,
    redirects: '1',
    format: 'json',
  });

  const data = await withRetry(
    async () => {
      const res = await rateLimitedFetch('wikipedia', `${apiUrl}?${params}`);
      if (!res.ok) throw new Error(`Wikipedia parse API ${res.status}`);
      return (await res.json()) as WikiParseResponse;
    },
    { source: 'wikipedia' }
  );

  return data.parse.text['*'];
}

/**
 * Fetch the FULL page HTML in a single API call.
 * Much more efficient than fetching section by section.
 */
async function fetchFullPageHtml(page: string, lang: string): Promise<{ html: string; title: string }> {
  const apiUrl = getApiUrl(lang);
  const params = new URLSearchParams({
    action: 'parse',
    page,
    prop: 'text',
    redirects: '1',
    format: 'json',
  });

  const data = await withRetry(
    async () => {
      const res = await rateLimitedFetch('wikipedia', `${apiUrl}?${params}`);
      if (!res.ok) throw new Error(`Wikipedia full-page API ${res.status}`);
      return (await res.json()) as WikiParseResponse;
    },
    { source: 'wikipedia' }
  );

  return { html: data.parse.text['*'], title: data.parse.title };
}

/**
 * Extract a section's HTML from the full page HTML by finding
 * the heading element and collecting all content until the next
 * heading of the same or higher level.
 */
function extractSectionFromFullHtml(
  $full: cheerio.CheerioAPI,
  section: WikiSection,
  allSections: WikiSection[]
): string {
  const level = parseInt(section.level, 10);
  const sectionTitle = stripHtml(section.line).trim();

  // Wikipedia wraps headings in <div class="mw-heading mw-heading3"><h3>...</h3></div>
  // We need to find the wrapper div, then iterate its SIBLINGS for content.
  // Also handle older format where headings are bare <h3> siblings.

  let wrapperEl: cheerio.Cheerio<AnyNode> | null = null;

  // Strategy 1: Find the mw-heading div by matching heading text inside it
  $full(`div.mw-heading${level}`).each((_, el) => {
    const text = $full(el).text().replace(/\[edit\]/gi, '').replace(/\[editar\]/gi, '').trim();
    if (text === sectionTitle) {
      wrapperEl = $full(el);
      return false;
    }
  });

  // Strategy 2: Find by span id inside the mw-heading div
  if (!wrapperEl) {
    const encodedId = sectionTitle.replace(/ /g, '_');
    const span = $full(`div.mw-heading span[id="${encodedId}"]`).first();
    if (span.length) {
      wrapperEl = span.closest('div.mw-heading');
    }
  }

  // Strategy 3: Fallback to bare heading elements (older MediaWiki format)
  if (!wrapperEl) {
    const headingTag = `h${level}`;
    $full(headingTag).each((_, el) => {
      // Only match headings NOT inside a mw-heading div
      if ($full(el).parent().hasClass(`mw-heading${level}`)) return;
      const text = $full(el).text().replace(/\[edit\]/gi, '').replace(/\[editar\]/gi, '').trim();
      if (text === sectionTitle) {
        wrapperEl = $full(el);
        return false;
      }
    });
  }

  // Strategy 4: Broader text match (case-insensitive, contains)
  if (!wrapperEl) {
    const lower = sectionTitle.toLowerCase();
    $full('div.mw-heading, h1, h2, h3, h4, h5, h6').each((_, el) => {
      const text = $full(el).text().replace(/\[edit\]/gi, '').replace(/\[editar\]/gi, '').trim().toLowerCase();
      if (text === lower || text.includes(lower)) {
        wrapperEl = $full(el);
        return false;
      }
    });
  }

  if (!wrapperEl || !wrapperEl.length) {
    return '';
  }

  // Collect all sibling elements after the heading/wrapper until next heading of same/higher level
  const parts: string[] = [];
  let current = wrapperEl.next();

  while (current.length) {
    const tagName = current.prop('tagName')?.toLowerCase() ?? '';
    const cls = current.attr('class') ?? '';

    // Stop at next heading of same or higher level
    // Check for mw-heading wrapper divs
    if (cls.includes('mw-heading')) {
      const match = cls.match(/mw-heading(\d)/);
      if (match) {
        const nextLevel = parseInt(match[1], 10);
        if (nextLevel <= level) break;
      }
    }
    // Check for bare heading elements
    if (/^h[1-6]$/.test(tagName)) {
      const nextLevel = parseInt(tagName[1], 10);
      if (nextLevel <= level) break;
    }

    parts.push($full.html(current) ?? '');
    current = current.next();
  }

  // Wrap in mw-parser-output so parseLineupHtml can find children correctly
  return `<div class="mw-parser-output">${parts.join('\n')}</div>`;
}

/**
 * Fetch the main page image (poster/logo) from Wikipedia.
 * Uses action=query&prop=pageimages to get the original-size image URL.
 */
async function fetchPageImage(page: string, lang: string): Promise<string | undefined> {
  const apiUrl = getApiUrl(lang);
  const params = new URLSearchParams({
    action: 'query',
    titles: page,
    prop: 'pageimages',
    piprop: 'original',
    redirects: '1',
    format: 'json',
  });

  try {
    const data = await withRetry(
      async () => {
        const res = await rateLimitedFetch('wikipedia', `${apiUrl}?${params}`);
        if (!res.ok) throw new Error(`Wikipedia pageimages API ${res.status}`);
        return (await res.json()) as { query: { pages: Record<string, { original?: { source: string } }> } };
      },
      { source: 'wikipedia' }
    );

    const pages = data.query?.pages;
    if (!pages) return undefined;
    const page0 = Object.values(pages)[0];
    return page0?.original?.source;
  } catch {
    return undefined;
  }
}

// ─── Section Detection ───────────────────────────────────────

/** Keywords that indicate a lineup section (case-insensitive) */
const LINEUP_SECTION_KEYWORDS = [
  'line-up', 'lineup', 'line up', 'lineups', 'line-ups',
  'cartel', 'carteles', // Spanish
  'artistas', 'artistas participantes',
  'performers', 'performing artists',
  'ediciones', // Spanish: "editions" (often contains lineups)
  'edições', // Portuguese: "editions"
  'festival summary by year', // summary tables with headliners
  'participantes', // Spanish: "participants"
  'actuaciones', // Spanish: "performances"
  'conciertos', // Spanish: "concerts"
];

/** Keywords for redirect to dedicated lineup pages */
const LINEUP_REDIRECT_KEYWORDS = [
  'list of', 'lineups by year', 'line-ups by year',
];

/**
 * Find the lineup section(s) in a Wikipedia page's section list.
 * Returns section indices to fetch.
 */
function findLineupSections(sections: WikiSection[]): WikiSection[] {
  const matches: WikiSection[] = [];
  const addedIndices = new Set<string>();

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const title = stripHtml(section.line).toLowerCase().trim();
    const level = parseInt(section.level);

    if (LINEUP_SECTION_KEYWORDS.some((kw) => title.includes(kw)) && level <= 3) {
      if (!addedIndices.has(section.index)) {
        matches.push(section);
        addedIndices.add(section.index);
      }

      // Also include all subsections under this parent
      const parentLevel = level;
      for (let j = i + 1; j < sections.length; j++) {
        const sub = sections[j];
        const subLevel = parseInt(sub.level);
        if (subLevel <= parentLevel) break; // reached next sibling or higher
        if (!addedIndices.has(sub.index)) {
          matches.push(sub);
          addedIndices.add(sub.index);
        }
      }
    }
  }

  // Fallback: if no keyword matches, look for edition sections with years
  // e.g., "Rock in Rio (1985)", "Rock in Rio 2 (1991)", "1ª Edición (2016)"
  // Heuristic: if 3+ sections at level 3+ contain a 4-digit year, treat them as editions
  if (matches.length === 0) {
    // Build parent h2 map for edition detection
    let currentParentH2 = '';
    const parentMap = new Map<string, string>(); // section index → parent h2 title
    for (const section of sections) {
      const level = parseInt(section.level);
      if (level === 2) {
        currentParentH2 = stripHtml(section.line);
      } else if (level >= 3 && currentParentH2) {
        parentMap.set(section.index, currentParentH2);
      }
    }

    // Filter out non-location parent sections that would produce false editions
    const NON_LOCATION_PARENTS = /^(history|historia|história|overview|background|legacy|controversy|incidents|reception|criticism|live broadcasts|related|see also|references|external links|bibliography|notes|footnotes)\b/i;

    const yearSections: WikiSection[] = [];
    for (const section of sections) {
      const title = stripHtml(section.line);
      const level = parseInt(section.level);
      // Check both level 2 and 3+ for year sections
      // Level 2 years = dedicated lineup pages (Glastonbury line-ups)
      // Level 3+ years = edition sections under city headers (Rock in Rio)
      // Match exact years (not "1990s", "2000s", "2010s")
      const hasExactYear = /\b(199\d|20[0-3]\d)\b/.test(title) && !/\b\d{4}s\b/.test(title);
      if (level >= 2 && hasExactYear) {
        const parent = parentMap.get(section.index) ?? '';
        // Only inject parentTitle if it looks like a location/venue, not a generic section
        section.parentTitle = NON_LOCATION_PARENTS.test(parent) ? undefined : parent || undefined;
        yearSections.push(section);
      }
    }
    if (yearSections.length >= 3) {
      for (const s of yearSections) {
        if (!addedIndices.has(s.index)) {
          matches.push(s);
          addedIndices.add(s.index);
        }
        // Also include subsections (e.g., city editions under a year)
        const idx = sections.indexOf(s);
        const parentLevel = parseInt(s.level);
        for (let j = idx + 1; j < sections.length; j++) {
          const sub = sections[j];
          const subLevel = parseInt(sub.level);
          if (subLevel <= parentLevel) break;
          sub.parentTitle = s.parentTitle; // propagate parent
          if (!addedIndices.has(sub.index)) {
            matches.push(sub);
            addedIndices.add(sub.index);
          }
        }
      }
    }
  }

  return matches;
}

/**
 * Detect if a section is a redirect to a dedicated lineup page.
 * e.g., "Main article: List of Lollapalooza lineups by year"
 */
function detectRedirectPage(html: string): string | null {
  const $ = cheerio.load(html);

  // Look for "Main article:" hatnote links
  const hatnote = $('div.hatnote a, .rellink a, .mainarticle a').first();
  if (hatnote.length) {
    const href = hatnote.attr('href') ?? '';
    const title = decodeURIComponent(href.replace('/wiki/', '').replace(/_/g, ' '));
    if (LINEUP_REDIRECT_KEYWORDS.some((kw) => title.toLowerCase().includes(kw))) {
      return title;
    }
  }

  // Also check for {{Main}} template output
  const mainDiv = $('div.hatnote').first();
  if (mainDiv.length) {
    const text = mainDiv.text().toLowerCase();
    if (text.includes('main article') || text.includes('artículo principal')) {
      const link = mainDiv.find('a').first();
      if (link.length) {
        const href = link.attr('href') ?? '';
        return decodeURIComponent(href.replace('/wiki/', '').replace(/_/g, ' '));
      }
    }
  }

  return null;
}

// ─── HTML Parsing ────────────────────────────────────────────

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

/** Extract a year (1990-2030) from text */
function extractYear(text: string): number | null {
  const match = text.match(/\b(199\d|20[0-3]\d)\b/);
  return match ? parseInt(match[1], 10) : null;
}

/** Clean artist name — remove footnotes, refs, whitespace */
function cleanArtistName(name: string): string {
  return name
    .replace(/\[.*?\]/g, '')       // [1], [note], etc.
    .replace(/\(.*?\)/g, '')       // (band), (musician)
    .replace(/\s+/g, ' ')
    .replace(/[.]+$/, '')          // trailing periods
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // zero-width chars
    .trim();
}

/** Check if text looks like a valid artist name (not a label/header/metadata) */
function isValidArtistName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 80) return false;
  // Skip headers, dates, locations, etc.
  if (/^\d{1,2}\s+(de\s+)?\w+/.test(name)) return false; // "12 de mayo"
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(name)) return false;
  if (/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(name)) return false;
  if (/^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i.test(name)) return false;
  if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(name)) return false;
  if (/^\d{1,2}\/\d{1,2}\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(name)) return false; // "05/27 Friday"
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(name) && name.length < 25) return false; // "6/30 Saturday"
  if (/^(location|date|venue|attendance|gross|edition|lugar|fecha)\b/i.test(name)) return false;
  if (/^\d+[,.]?\d*$/.test(name)) return false; // pure numbers (attendance, etc.)
  if (/^\d{4}\s*[:;\-–—]?\s*$/.test(name)) return false; // bare year "2020 :"
  if (name.startsWith('http')) return false;
  // Skip category/section labels
  if (/^invitados?\b/i.test(name)) return false;
  if (/^artistas?\s+(invitad|participan|nacional|internacional)/i.test(name)) return false;
  if (/^(main stage|second stage|side stage|escenario)\b/i.test(name)) return false;
  if (/^(day|día)\s+(\d|one|two|three|four|five|six|seven)/i.test(name)) return false;
  // Skip Wikipedia template artifacts
  if (/^citation needed/i.test(name)) return false;
  if (/^(original research|unreliable source|better source)/i.test(name)) return false;
  // Skip contextual words
  if (/^cancelad[oa]/i.test(name)) return false;
  if (/^reemplazad[oa]/i.test(name)) return false;
  if (/^(cancelled|replaced|postponed|suspended)\b/i.test(name)) return false;
  if (/^(la pandemia|pandemia|covid)/i.test(name)) return false;
  if (/^fue\s+/i.test(name)) return false;
  if (/^por\s+(la\s+)?/i.test(name) && name.length < 30) return false;
  // Skip prose fragments (sentences with periods, long phrases with common words)
  if (/\.\s+[A-Z]/.test(name)) return false; // "foo. Bar" = two sentences
  if (/\b(was announced|was held|took place|which proved|in their first|phase two|phase one)\b/i.test(name)) return false;
  if (/\b(the festival|the edition|the lineup|the headliners?)\b/i.test(name) && name.length > 30) return false;
  if (/^\d{4}\b.{10,}/i.test(name)) return false; // "2016 was announced on December 16"
  if (/^(and|or|the)\s+\./i.test(name)) return false; // "and . Danish band..."
  if (/\b(opened|closed)\s+(the\s+)?(main |orange |pyramid )?stage/i.test(name)) return false;
  // Skip dashes-only noise
  if (/^[\s\-–—]+$/.test(name)) return false;
  if (name.split('-').length > 10) return false; // "- - - - - - - - - -..."
  return true;
}

// ─── Pattern: Extract artists from <a> links ────────────────

/**
 * Extract artist names from all <a> links within an element.
 * This is the most common pattern — artists are Wikipedia links.
 */
function extractArtistsFromLinks($: cheerio.CheerioAPI, el: cheerio.Cheerio<Element>): ArtistEntry[] {
  const artists: ArtistEntry[] = [];
  const seen = new Set<string>();

  el.find('a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') ?? '';

    // Skip internal/meta links
    if (href.startsWith('#')) return;
    if (href.includes('Wikipedia:')) return;
    if (href.includes('Help:')) return;
    if (href.includes('Special:')) return;
    if (href.includes('File:')) return;
    if (href.includes('Category:')) return;
    // Skip citation/reference links
    if ($a.parents('sup.reference').length > 0) return;
    if ($a.parents('.reflist').length > 0) return;
    if ($a.hasClass('external')) return;
    // Skip navbox, see-also, etc.
    if ($a.parents('.navbox').length > 0) return;
    if ($a.parents('.mw-references-wrap').length > 0) return;

    const name = cleanArtistName($a.text());
    if (!isValidArtistName(name)) return;

    const lowerName = name.toLowerCase();
    if (seen.has(lowerName)) return;
    seen.add(lowerName);

    // Check if headliner (wrapped in <b>)
    const isHeadliner = $a.parent('b').length > 0 || $a.parents('b').length > 0;

    artists.push({ name, isHeadliner });
  });

  return artists;
}

/**
 * Extract artists from comma/separator-separated text (including non-linked names).
 * Used for patterns where some artists don't have Wikipedia links.
 */
function extractArtistsFromText(text: string): string[] {
  // First strip contextual noise
  const cleaned = stripContextualNoise(text);
  // Split by comma, middle dot, bullet, semicolon, or " - " (but not hyphens within names)
  // Split by comma, middle dot, bullet, semicolon, or dash separators
  // NOTE: Do NOT split by "y" or "and" — many band names contain these
  // (e.g., "Nicolás y los Fumadores", "Mortis y los Desalmados", "Echo and the Bunnymen")
  const parts = cleaned.split(/[,;·•]|\s+[–—]\s+/);
  return parts
    .map((p) => cleanArtistName(p))
    .filter(isValidArtistName);
}

/** Remove contextual phrases that aren't artist names */
function stripContextualNoise(text: string): string {
  return text
    // Spanish contextual phrases
    .replace(/\(cancelad[oa][^)]*\)/gi, '')
    .replace(/\(reemplazad[oa][^)]*\)/gi, '')
    .replace(/fue reemplazad[oa]\s+por\b/gi, ',')
    .replace(/cancelad[oa]\s+(de\s+)?último momento[^,.]*/gi, '')
    .replace(/cancelad[oa]\s+semanas?\s+antes[^,.]*/gi, '')
    .replace(/cancelad[oa]\s+por\b[^,.]*/gi, '')
    .replace(/debido\s+a[^,.]*/gi, '')
    // English contextual phrases
    .replace(/\(cancelled[^)]*\)/gi, '')
    .replace(/\(replaced[^)]*\)/gi, '')
    .replace(/was replaced by\b/gi, ',')
    .replace(/cancelled\b[^,.]*/gi, '')
    .replace(/due to\b[^,.]*/gi, '')
    // Parenthetical notes about specific artists
    .replace(/\([^)]{0,100}(fallecimiento|muerte|death|injury|lesión)[^)]*\)/gi, '')
    .trim();
}

/**
 * Extract only the text that is NOT inside <a> links.
 * Used for year-inline patterns to avoid duplicating linked artist names
 * and breaking names that contain commas (e.g., "Tyler, The Creator").
 */
function extractUnlinkedText($: cheerio.CheerioAPI, el: cheerio.Cheerio<Element>, boldText: string): string {
  // Clone element and remove all <a>, <b>, <sup> tags
  const clone = el.clone();
  clone.find('a, b, sup').remove();
  let text = clone.text();
  // Remove the bold year prefix if still present
  if (boldText) {
    const idx = text.indexOf(boldText);
    if (idx !== -1) text = text.substring(idx + boldText.length);
  }
  // Remove leading separator
  text = text.replace(/^\s*[-–—:]\s*/, '');
  return text;
}

// ─── Pattern: Table with stage columns (Coachella style) ─────

function parseStageTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<Element>, day?: string): ArtistEntry[] {
  const artists: ArtistEntry[] = [];
  const seen = new Set<string>();

  // Get stage names from <th> headers
  const stages: string[] = [];
  table.find('tr').first().find('th').each((_, th) => {
    stages.push($(th).text().trim());
  });

  // Each subsequent row has <td> per stage
  table.find('tr').slice(1).each((_, row) => {
    $(row).find('td').each((colIdx, td) => {
      const stage = stages[colIdx] || undefined;
      const $td = $(td);

      // Artists are in <li> or as <a> links
      $td.find('li').each((_, li) => {
        const $li = $(li);
        const link = $li.find('a').first();
        const name = cleanArtistName(link.length ? link.text() : $li.text());
        if (!isValidArtistName(name)) return;
        const lower = name.toLowerCase();
        if (seen.has(lower)) return;
        seen.add(lower);

        const isHeadliner = $li.find('b').length > 0 || $li.parent('b').length > 0;
        artists.push({ name, isHeadliner, stage, day });
      });

      // If no <li>, try direct <a> links
      if ($td.find('li').length === 0) {
        const tdArtists = extractArtistsFromLinks($, $td);
        for (const a of tdArtists) {
          const lower = a.name.toLowerCase();
          if (seen.has(lower)) continue;
          seen.add(lower);
          artists.push({ ...a, stage, day });
        }
      }
    });
  });

  return artists;
}

// ─── Pattern: Summary table (Primavera Sound style) ──────────
// Table with columns like "Year", "Headliners" — extract year + artists per row

function parseSummaryTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<Element>): YearLineup[] {
  const headers: string[] = [];
  table.find('tr').first().find('th').each((_, th) => {
    headers.push($(th).text().trim().toLowerCase());
  });

  // Find year and headliner columns
  const yearCol = headers.findIndex((h) => h === 'year' || h === 'año');
  const headlinerCol = headers.findIndex((h) =>
    h.includes('headliner') || h.includes('artist') || h.includes('artista') || h.includes('lineup')
  );

  if (yearCol === -1 || headlinerCol === -1) return [];

  const years: YearLineup[] = [];

  table.find('tr').slice(1).each((_, row) => {
    const cells = $(row).find('td');
    const yearCell = cells.eq(yearCol);
    const headlinerCell = cells.eq(headlinerCol);

    const year = extractYear(yearCell.text());
    if (!year) return;

    const artists = extractArtistsFromLinks($, headlinerCell);
    // Also try text-based extraction for middot-separated names
    if (artists.length === 0) {
      const names = extractArtistsFromText(headlinerCell.text());
      for (const name of names) {
        artists.push({ name, isHeadliner: true });
      }
    }

    if (artists.length > 0) {
      // Mark all as headliners since this is a summary table
      years.push({ year, artists: artists.map((a) => ({ ...a, isHeadliner: true })) });
    }
  });

  return years;
}

// ─── Main Section Parser ─────────────────────────────────────

/**
 * Parse a lineup HTML section and extract artists grouped by year.
 * Handles all known Wikipedia patterns.
 */
function parseLineupHtml(html: string, fallbackYear?: number, fallbackEdition?: string): YearLineup[] {
  const $ = cheerio.load(html);
  const yearMap = new Map<number, Map<string, ArtistEntry>>();

  // Edition tracking — for multi-country festivals like Knotfest
  // Blacklist of section titles that are NOT edition labels
  const EDITION_BLACKLIST = /^(dates?|line-?ups?|performers?|artists?|bands?|tickets?|stages?|schedule|format|venue|venues|history|references|see also|external links|notes|overview|background|legacy|details|other acts|side\s*shows?|tour|tours|set\s*list|critical|reception|incidents?|aftermath|cancellation|media|broadcast|sponsors|pre-?party|cambios?|cancelaci[oó]n|cancelaciones|actos?\s|sorpresa|confirmados?|anunciados?|novedades?|noticias|actuaciones?|bajas?|sustituciones?|rumores?)\b/i;

  let currentEdition: string | undefined = fallbackEdition;

  /** Get or create year bucket */
  function getYear(y: number): Map<string, ArtistEntry> {
    if (!yearMap.has(y)) yearMap.set(y, new Map());
    return yearMap.get(y)!;
  }

  /** Add artist to year bucket (dedup by edition+lowercase name) */
  function addArtist(year: number, artist: ArtistEntry) {
    // Auto-inject current edition if not already set
    if (!artist.edition && currentEdition) {
      artist = { ...artist, edition: currentEdition };
    }
    const bucket = getYear(year);
    // Dedup key includes edition — same artist can play different editions
    const key = (artist.edition ? `${artist.edition}::` : '') + artist.name.toLowerCase();
    if (!bucket.has(key)) {
      bucket.set(key, artist);
    } else if (artist.isHeadliner) {
      bucket.get(key)!.isHeadliner = true;
    }
  }

  // ── Strategy 1: Tables ──
  const tables = $('table.wikitable');
  if (tables.length > 0) {
    // First, try summary tables (Year | Headliners pattern)
    tables.each((_, tbl) => {
      const summaryYears = parseSummaryTable($, $(tbl));
      for (const yl of summaryYears) {
        for (const a of yl.artists) addArtist(yl.year, a);
      }
    });
    if (yearMap.size > 0) {
      return buildResult(yearMap);
    }

    // Then try stage-column tables with year/day context from headers
    let currentYearT: number | null = null;
    let currentDayT: string | undefined;

    // Walk ALL top-level children (not just h2/h3/h4/table) to catch mw-heading divs
    const parserOut = $('.mw-parser-output');
    const topChildren = parserOut.length ? parserOut.children() : $.root().children();
    topChildren.each((_, el) => {
      const $el = $(el);
      let tag = el.tagName?.toLowerCase();

      // Unwrap mw-heading divs to get the actual header
      if (tag === 'div' && $el.hasClass('mw-heading')) {
        const inner = $el.find('h2, h3, h4, h5').first();
        if (inner.length) {
          tag = inner.prop('tagName')?.toLowerCase() ?? tag;
          const text = inner.text().replace(/\[.*?\]/g, '').trim();
          const year = extractYear(text);

          const isDayHeader = /\b(friday|saturday|sunday|thursday|monday|tuesday|wednesday)\b/i.test(text) ||
              /\b(viernes|sábado|domingo|jueves|lunes|martes|miércoles)\b/i.test(text);

          // h4/h5 with a year that matches current year → edition, not a new year
          // e.g., "Ozzfest Meets Knotfest 2017" under "2017 line-up"
          if ((tag === 'h4' || tag === 'h5') && year && year === currentYearT) {
            const editionText = stripHtml(text).replace(/\b\d{4}\b/g, '').replace(/\s{2,}/g, ' ').trim();
            if (editionText.length > 1 && editionText.length < 40 && !editionText.includes(',') && !EDITION_BLACKLIST.test(editionText)) {
              currentEdition = editionText;
              currentDayT = undefined;
            }
          } else if (year) {
            currentYearT = year;
            currentDayT = undefined;
            currentEdition = fallbackEdition; // restore to fallback, not undefined
          }

          if (isDayHeader) {
            currentDayT = stripHtml(text);
          }

          // Edition/region detection — h4/h5 that is NOT a year or day
          if ((tag === 'h4' || tag === 'h5') && !year && !isDayHeader) {
            const editionText = stripHtml(text);
            if (editionText.length > 1 && editionText.length < 40 && !editionText.includes(',') && !EDITION_BLACKLIST.test(editionText)) {
              currentEdition = editionText;
              currentDayT = undefined;
            }
          }
        }
        return; // Skip to next element
      }

      if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const text = $el.text().replace(/\[.*?\]/g, '').trim();
        const year = extractYear(text);

        const isDayHeader = /\b(friday|saturday|sunday|thursday|monday|tuesday|wednesday)\b/i.test(text) ||
            /\b(viernes|sábado|domingo|jueves|lunes|martes|miércoles)\b/i.test(text);

        // h4 with a year matching current year → edition, not a new year
        if (tag === 'h4' && year && year === currentYearT) {
          const editionText = stripHtml(text).replace(/\b\d{4}\b/g, '').replace(/\s{2,}/g, ' ').trim();
          if (editionText.length > 1 && editionText.length < 40 && !editionText.includes(',') && !EDITION_BLACKLIST.test(editionText)) {
            currentEdition = editionText;
            currentDayT = undefined;
          }
        } else if (year) {
          currentYearT = year;
          currentDayT = undefined;
          currentEdition = fallbackEdition; // restore to fallback, not undefined
        }

        if (isDayHeader) {
          currentDayT = stripHtml(text);
        }

        // Edition/region detection — h4 that is NOT a year or day
        if (tag === 'h4' && !year && !isDayHeader) {
          const editionText = stripHtml(text);
          if (editionText.length > 1 && editionText.length < 40 && !editionText.includes(',') && !EDITION_BLACKLIST.test(editionText)) {
            currentEdition = editionText;
            currentDayT = undefined;
          }
        }
      }

      if (tag === 'table' && $el.hasClass('wikitable')) {
        const year = currentYearT ?? fallbackYear;
        if (!year) return;
        const artists = parseStageTable($, $el, currentDayT);
        for (const a of artists) addArtist(year, a);
      }
    });

    if (yearMap.size > 0) {
      return buildResult(yearMap);
    }
  }

  // ── Strategy 2: Walk headers + content blocks ──
  // This handles <ul> lists, <p> with links, etc.
  let currentYear: number | null = null;
  let currentDay: string | undefined;
  let currentStage: string | undefined;

  // Process all top-level elements in order
  // Wikipedia wraps content in <div class="mw-parser-output">
  const parserOutput = $('.mw-parser-output');
  const body = parserOutput.length ? parserOutput : ($.root() as unknown as cheerio.Cheerio<Element>);
  const children = (body as cheerio.Cheerio<Element>).children();

  children.each((_, el) => {
    const $el = $(el);
    let tag = el.tagName?.toLowerCase();

    // Wikipedia wraps headers in <div class="mw-heading mw-heading3"> etc.
    // Unwrap to get the actual header tag
    let headerEl = $el;
    if (tag === 'div' && $el.hasClass('mw-heading')) {
      const inner = $el.find('h2, h3, h4, h5').first();
      if (inner.length) {
        headerEl = inner;
        tag = inner.prop('tagName')?.toLowerCase() ?? tag;
      }
    }

    // ── Headers: extract year, day, edition, stage ──
    if (tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5') {
      const text = headerEl.text().replace(/\[.*?\]/g, '').trim();
      const year = extractYear(text);

      // Day detection
      const isDayHeader = /\b(friday|saturday|sunday|thursday|monday|tuesday|wednesday)\b/i.test(text) ||
          /\b(viernes|sábado|domingo|jueves|lunes|martes|miércoles)\b/i.test(text);

      // h4/h5 with a year matching current year → edition, not a new year
      // e.g., "Ozzfest Meets Knotfest 2017" under "2017 line-up"
      if ((tag === 'h4' || tag === 'h5') && year && year === currentYear) {
        const editionText = stripHtml(text).replace(/\b\d{4}\b/g, '').replace(/\s{2,}/g, ' ').trim();
        if (editionText.length > 1 && editionText.length < 60 && !EDITION_BLACKLIST.test(editionText)) {
          currentEdition = editionText;
          currentDay = undefined;
          currentStage = undefined;
        }
      } else if (year) {
        currentYear = year;
        currentDay = undefined;
        currentStage = undefined;
        currentEdition = fallbackEdition; // restore to fallback, not undefined
      }

      if (isDayHeader) {
        currentDay = text;
      }

      // Edition/region detection — h4/h5 that is NOT a year or day
      // e.g., "Australia", "Mexico", "Iowa"
      if ((tag === 'h4' || tag === 'h5') && !year && !isDayHeader) {
        const editionText = stripHtml(text);
        if (editionText.length > 1 && editionText.length < 60 && !EDITION_BLACKLIST.test(editionText)) {
          currentEdition = editionText;
          currentDay = undefined;
          currentStage = undefined;
        }
      }
    }

    // ── Italic/bold paragraph = stage name ──
    if (tag === 'p') {
      const italic = $el.find('i').first();
      if (italic.length && italic.text().length < 50) {
        const stageText = italic.text().trim();
        // If it looks like a stage name (short, no year), set it
        if (!extractYear(stageText) && stageText.length > 1) {
          currentStage = stageText;
        }
      }
    }

    // ── Collapsible divs (Lollapalooza modern) ──
    if ($el.hasClass('mw-collapsible') || $el.find('.mw-collapsible-content').length) {
      const content = $el.find('.mw-collapsible-content').first();
      const target = content.length ? content : $el;

      // Check title for year
      const titleDiv = $el.find('.hidden-title, .mw-collapsible-toggle').first();
      if (titleDiv.length) {
        const y = extractYear(titleDiv.text());
        if (y) currentYear = y;
      }

      // Parse content inside collapsible
      const innerHtml = target.html() ?? '';
      const innerYears = parseLineupHtml(innerHtml, currentYear ?? undefined);
      for (const yl of innerYears) {
        for (const a of yl.artists) addArtist(yl.year, a);
      }
      return; // continue to next element
    }

    // ── <ul> lists ──
    // Check first for year-inline pattern (doesn't need currentYear)
    if (tag === 'ul') {
      $el.children('li').each((_, li) => {
        const $li = $(li);
        const liText = $li.text().trim();

        // Check for year-inline pattern:
        //   <li><b>2010 (date)</b> - Artist1, Artist2...</li>  (Spanish Wikipedia)
        //   <li>2016 (16–18 June): Artist1 · Artist2 · ...</li>  (English Wikipedia)
        const boldLabel = $li.children('b').first();
        const boldText = boldLabel.length ? boldLabel.text().trim() : '';
        // Try extracting year from bold first, then from the li text directly
        let inlineYear = boldText ? extractYear(boldText) : null;
        let prefixLen = boldText.length;
        if (!inlineYear) {
          // Try to match year at the start of the li text: "2016 (date): ..."
          const yearMatch = liText.match(/^(\d{4})\s*\([^)]*\)\s*[:;\-–—]/);
          if (yearMatch) {
            inlineYear = parseInt(yearMatch[1]);
            if (inlineYear < 1950 || inlineYear > 2030) inlineYear = null;
            else prefixLen = yearMatch[0].length;
          }
        }
        if (inlineYear) {
          // Everything after the prefix + separator is artist list
          const afterPrefix = liText.substring(prefixLen).trim();
          // Find separator (-, :, –) after prefix
          const sepMatch = afterPrefix.match(/^[\-–—:;]\s*/);
          const artistText = sepMatch
            ? afterPrefix.substring(sepMatch[0].length).trim()
            : afterPrefix;
          if (artistText.length > 5) {
            // Extract linked artists (preserves full names like "Tyler, The Creator")
            const linked = extractArtistsFromLinks($, $li);
            const linkedNames = new Set(linked.map((a) => a.name.toLowerCase()));
            for (const a of linked) addArtist(inlineYear, a);

            // Extract unlinked names: remove link text, then split remainder
            const unlinkedText = extractUnlinkedText($, $li, boldText);
            const unlinkedNames = extractArtistsFromText(unlinkedText);
            for (const name of unlinkedNames) {
              if (!linkedNames.has(name.toLowerCase())) {
                addArtist(inlineYear, { name, isHeadliner: false });
              }
            }
            return; // continue to next <li>
          }
        }
        // For remaining patterns, we need a year from headers
        const year = currentYear ?? fallbackYear;
        if (!year) return;

        // Check if this <li> is a stage label: "<b>Stage Name</b>: artists..."
        if (boldLabel.length && liText.includes(':')) {
          const labelText = boldLabel.text().trim();
          const afterColon = liText.substring(liText.indexOf(':') + 1).trim();
          if (afterColon && afterColon.length > 3) {
            const stage = labelText;
            // Extract linked artists
            const linked = extractArtistsFromLinks($, $li);
            const linkedNames = new Set(linked.map((a) => a.name.toLowerCase()));
            for (const a of linked) {
              addArtist(year, { ...a, stage, day: currentDay });
            }
            // Also extract unlinked artists from remaining text
            const unlinked = extractUnlinkedText($, $li, labelText);
            const unlinkedNames = extractArtistsFromText(unlinked);
            for (const name of unlinkedNames) {
              if (!linkedNames.has(name.toLowerCase())) {
                addArtist(year, { name, isHeadliner: false, stage, day: currentDay });
              }
            }
            return;
          }
          // Bold-only label with no artists after colon — set as current stage
          if (!afterColon || afterColon.length <= 3) {
            currentStage = labelText.replace(/:$/, '').trim();
            return;
          }
        }

        // Check if this is a category header (bold-only <li> like "Invitados Nacionales:")
        if (boldLabel.length && !$li.find('a').length && liText.endsWith(':')) {
          currentStage = boldLabel.text().trim().replace(/:$/, '');
          return;
        }

        // Regular <li> — extract linked + unlinked artists
        const links = $li.find('a').not('sup.reference a, .external');
        if (links.length > 0) {
          // Has some links — extract both linked and unlinked names
          const linked = extractArtistsFromLinks($, $li);
          const linkedNames = new Set(linked.map((a) => a.name.toLowerCase()));
          for (const a of linked) {
            addArtist(year, { ...a, stage: currentStage, day: currentDay });
          }
          // Also get unlinked names from remaining text
          const unlinked = extractUnlinkedText($, $li, '');
          const unlinkedNames = extractArtistsFromText(unlinked);
          for (const name of unlinkedNames) {
            if (!linkedNames.has(name.toLowerCase())) {
              addArtist(year, { name, isHeadliner: false, stage: currentStage, day: currentDay });
            }
          }
        } else {
          // No links at all — comma-separated plain text
          const names = extractArtistsFromText(liText);
          for (const n of names) {
            addArtist(year, { name: n, isHeadliner: false, stage: currentStage, day: currentDay });
          }
        }
      });
    }

    const year = currentYear ?? fallbackYear;
    if (!year) return;

    // ── Layout containers (col-begin tables rendered as divs, multicol, etc.) ──
    // Wikipedia uses layout tables/divs to arrange artist lists in columns.
    // These appear as <div> or <table> with nested <ul> lists and day/stage headers.
    if ((tag === 'table' && !$el.hasClass('wikitable') && !$el.hasClass('navbox')) ||
        (tag === 'div' && !$el.hasClass('hatnote') && !$el.hasClass('navbox') &&
         !$el.hasClass('mw-heading') && !$el.hasClass('mw-references-wrap'))) {
      const innerLists = $el.find('ul li a[href^="/wiki/"]');
      if (innerLists.length >= 3) {
        let localDay = currentDay;
        let localStage = currentStage;

        // Walk all inner elements looking for structure
        const DAY_RE = /\b(friday|saturday|sunday|thursday|monday|tuesday|wednesday)\b/i;
        const DAY_RE_ES = /\b(viernes|sábado|domingo|jueves|lunes|martes|miércoles)\b/i;
        const DAY_NUM_RE = /\b(day\s+\d|día\s+\d)\b/i;

        $el.find('dt, p, ul').each((_, inner) => {
          const $inner = $(inner);
          const innerTag = inner.tagName?.toLowerCase();

          // Day headers: <dt>, <p><b>, or plain <p> with day name
          if (innerTag === 'dt' || innerTag === 'p') {
            const dayText = $inner.text().trim();
            if (DAY_RE.test(dayText) || DAY_RE_ES.test(dayText) || DAY_NUM_RE.test(dayText)) {
              localDay = dayText.replace(/\[.*?\]/g, '').trim();
            } else if (innerTag === 'p') {
              // Skip Wikipedia template artifacts
              if (/citation needed|original research|unreliable/i.test(dayText)) return;
              // Stage names: <p><i>Stage</i></p> or <p>Stage:</p>
              const italic = $inner.find('i').first();
              if (italic.length && italic.text().trim().length < 50 && !extractYear(italic.text())) {
                const stageCandidate = italic.text().trim();
                if (!/citation needed|original research/i.test(stageCandidate)) {
                  localStage = stageCandidate;
                }
              } else if (dayText.endsWith(':') && dayText.length < 60) {
                const stageCandidate = dayText.replace(/:$/, '').trim();
                if (!/citation needed|original research/i.test(stageCandidate)) {
                  localStage = stageCandidate;
                }
              }
            }
          }

          // Artist lists
          if (innerTag === 'ul') {
            $inner.children('li').each((_, li) => {
              const $li = $(li);
              const link = $li.find('a').not('sup.reference a, .external').first();
              if (link.length) {
                const href = link.attr('href') ?? '';
                if (!href.startsWith('/wiki/')) return;
                if (href.includes('Wikipedia:') || href.includes('Help:') || href.includes('Category:')) return;
              }
              const name = cleanArtistName(link.length ? link.text() : $li.text());
              if (!isValidArtistName(name)) return;
              const isHeadliner = $li.find('b').length > 0;
              // Don't pass garbage stage names
              const cleanStage = localStage && !/citation needed|original research|unreliable/i.test(localStage)
                ? localStage : undefined;
              addArtist(year, { name, isHeadliner, stage: cleanStage, day: localDay });
            });
          }
        });
      }
    }

    // ── <p> with comma-separated artists (linked + unlinked) ──
    // Extract from paragraphs that look like artist lists.
    // Heuristic: 3+ wiki links with reasonable density (>20% of text is links)
    if (tag === 'p') {
      const paraText = $el.text();
      // Skip paragraphs about visual arts, exhibitions, or non-music contexts
      // e.g. "exposiciones de artistas de la talla de Miquel Barceló..."
      const NON_MUSIC_PARA = /\b(exposici[oó]n|exhibici[oó]n|instalaci[oó]n|arte\s+por|artistas?\s+(visuales?|pl[aá]stic|gr[aá]fic)|muestra|galería|pintor|escultor|cine|teatro|danza|ballet)\b/i;
      if (NON_MUSIC_PARA.test(paraText)) return;

      const links = $el.find('a').not('sup.reference a, .reflist a, .external');
      if (links.length >= 3) {
        const totalText = paraText.length;
        const linkText = links.toArray().reduce((sum, a) => sum + $(a).text().length, 0);
        const linkDensity = linkText / Math.max(totalText, 1);
        if (linkDensity > 0.20) {
          // 1. Linked artists (full name preserved, e.g. "Tyler, The Creator")
          const linked = extractArtistsFromLinks($, $el);
          const linkedNames = new Set(linked.map((a) => a.name.toLowerCase()));
          for (const a of linked) {
            addArtist(year, { ...a, stage: currentStage, day: currentDay });
          }
          // 2. Unlinked artists from remaining text
          const unlinked = extractUnlinkedText($, $el, '');
          const unlinkedNames = extractArtistsFromText(unlinked);
          for (const name of unlinkedNames) {
            if (!linkedNames.has(name.toLowerCase())) {
              addArtist(year, { name, isHeadliner: false, stage: currentStage, day: currentDay });
            }
          }
        }
      }
    }

    // ── <div> blocks (sometimes used instead of <p>) ──
    if (tag === 'div' && !$el.hasClass('hatnote') && !$el.hasClass('navbox') && !$el.hasClass('mw-heading') && !$el.hasClass('mw-references-wrap')) {
      const links = $el.find('a').not('sup.reference a, .reflist a, .external');
      if (links.length >= 3) {
        const linked = extractArtistsFromLinks($, $el);
        const linkedNames = new Set(linked.map((a) => a.name.toLowerCase()));
        for (const a of linked) {
          addArtist(year, { ...a, stage: currentStage, day: currentDay });
        }
        const unlinked = extractUnlinkedText($, $el, '');
        const unlinkedNames = extractArtistsFromText(unlinked);
        for (const name of unlinkedNames) {
          if (!linkedNames.has(name.toLowerCase())) {
            addArtist(year, { name, isHeadliner: false, stage: currentStage, day: currentDay });
          }
        }
      }
    }
  });

  return buildResult(yearMap);
}

function buildResult(yearMap: Map<number, Map<string, ArtistEntry>>): YearLineup[] {
  const results: YearLineup[] = [];
  for (const [year, artistMap] of yearMap) {
    const artists = Array.from(artistMap.values());
    if (artists.length === 0) continue;

    // Check if this year has multiple editions (multi-city festivals)
    const editionGroups = new Map<string, ArtistEntry[]>();
    let noEditionCount = 0;
    for (const a of artists) {
      const ed = a.edition ?? '';
      if (!ed) noEditionCount++;
      if (!editionGroups.has(ed)) editionGroups.set(ed, []);
      editionGroups.get(ed)!.push(a);
    }

    // If all artists share the same edition (or none), emit one YearLineup
    // If multiple editions exist, split into separate YearLineups per edition
    const distinctEditions = [...editionGroups.keys()].filter(e => e !== '');
    if (distinctEditions.length <= 1) {
      // Single edition or no edition — one entry
      results.push({
        year,
        artists,
        edition: distinctEditions[0] || undefined,
      });
    } else {
      // Multiple editions — split into separate entries per edition
      for (const [edition, edArtists] of editionGroups) {
        if (edArtists.length === 0) continue;
        results.push({
          year,
          artists: edArtists,
          edition: edition || undefined,
        });
      }
    }
  }
  return results.sort((a, b) => a.year - b.year || (a.edition ?? '').localeCompare(b.edition ?? ''));
}

// ─── Festival Page Parser ────────────────────────────────────

/**
 * Parse a single festival's Wikipedia page for lineup data.
 * Returns null if no lineup section found.
 */
export async function parseFestivalLineup(
  title: string,
  lang: string,
  pageId: number,
  _depth = 0
): Promise<FestivalLineup | null> {
  const pageSlug = title.replace(/ /g, '_');

  try {
    // ── OPTIMIZED: 2 API calls instead of N per section ──
    // Call 1: sections list (lightweight, needed for structure)
    // Call 2: full page HTML (one big fetch, parse locally)
    const sections = await fetchSections(pageSlug, lang);
    const lineupSections = findLineupSections(sections);

    if (lineupSections.length === 0) {
      log.debug(`No lineup section: ${title} [${lang}]`);
      return null;
    }

    // Fetch full page HTML in ONE call
    const { html: fullHtml } = await fetchFullPageHtml(pageSlug, lang);
    const $full = cheerio.load(fullHtml);

    let sourcePage = title;
    const allYears: YearLineup[] = [];
    const allInsights: FestivalInsight[] = [];

    // Check for redirect in any lineup section
    for (const section of lineupSections) {
      // Extract this section's HTML from the full page using heading IDs
      const sectionHtml = extractSectionFromFullHtml($full, section, sections);
      const redirect = detectRedirectPage(sectionHtml);
      if (redirect && _depth < 1) {
        log.debug(`Redirect: ${title} → ${redirect}`);
        const redirectResult = await parseFestivalLineup(redirect, lang, pageId, _depth + 1);
        if (redirectResult) {
          redirectResult.title = title;
          redirectResult.pageId = pageId;
          redirectResult.sourcePage = redirect;

          // Extract poster, insights, and location from the ORIGINAL full HTML
          if (!redirectResult.posterUrl) {
            redirectResult.posterUrl = await fetchPageImage(pageSlug, lang);
          }

          // Extract insights + location from intro (first paragraphs of full page)
          const introInsights = extractInsights(fullHtml);
          if (introInsights.length > 0) {
            const existing = redirectResult.insights ?? [];
            const seen = new Set(existing.map(i => `${i.type}:${i.text.substring(0, 60)}`));
            for (const i of introInsights) {
              const key = `${i.type}:${i.text.substring(0, 60)}`;
              if (!seen.has(key)) { seen.add(key); existing.push(i); }
            }
            redirectResult.insights = existing;
          }
          if (!redirectResult.location) {
            const loc = extractLocation(fullHtml);
            if (loc) redirectResult.location = normalizeLocation(loc);
          }
          if (!redirectResult.location) {
            redirectResult.location = extractLocationFromTitle(title) ?? undefined;
          }

          return redirectResult;
        }
        continue;
      }
    }

    // No redirect — parse lineup sections from full HTML
    for (const section of lineupSections) {
      const sectionHtml = extractSectionFromFullHtml($full, section, sections);

      const sectionTitle = stripHtml(section.line);
      const sectionYear = extractYear(sectionTitle);
      let sectionEdition: string | undefined;

      if (section.parentTitle) {
        const remainder = sectionTitle
          .replace(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
          .replace(/\b\d{4}\b/g, '')
          .replace(/\b\d{1,2}\b/g, '')
          .replace(/[()&]/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        if (remainder.length >= 2) {
          sectionEdition = remainder;
        } else {
          sectionEdition = section.parentTitle;
        }
      }

      const years = parseLineupHtml(sectionHtml, sectionYear ?? undefined, sectionEdition);

      // Extract precise dates
      if (sectionYear) {
        const dateInfo = extractDate(sectionHtml, sectionYear);
        if (dateInfo) {
          for (const yl of years) {
            if (yl.year === sectionYear && !yl.date) {
              yl.date = dateInfo.date;
              yl.dateEnd = dateInfo.dateEnd;
            }
          }
        }
      }

      allYears.push(...years);

      const sectionInsights = extractInsights(sectionHtml, sectionYear ?? undefined, sectionEdition);
      allInsights.push(...sectionInsights);
    }

    if (allYears.length === 0) {
      log.debug(`No artists extracted: ${title} [${lang}]`);
      return null;
    }

    // Merge duplicate years (edition-aware)
    const merged = mergeYears(allYears);

    // Resolve edition strings to locations
    for (const yl of merged) {
      if (yl.edition && !yl.location) {
        const edLoc = extractLocationFromTitle(yl.edition);
        if (edLoc) yl.location = normalizeLocation(edLoc);
      }
    }

    const editionCount = merged.filter(y => y.edition).length;
    const totalArtists = merged.reduce((sum, y) => sum + y.artists.length, 0);
    log.debug(`${title}: ${merged.length} years, ${totalArtists} artists${editionCount > 0 ? `, ${editionCount} with editions` : ''}`);

    // Extract location + insights from full HTML (intro + history sections included)
    let festivalLocation: FestivalLocation | undefined;
    const loc = extractLocation(fullHtml);
    if (loc) festivalLocation = normalizeLocation(loc);
    if (!festivalLocation) {
      festivalLocation = extractLocationFromTitle(title) ?? undefined;
    }

    // Extract insights from full page prose (covers intro, history, and all sections)
    const fullInsights = extractInsights(fullHtml);
    for (const i of fullInsights) {
      const key = `${i.type}:${i.text.substring(0, 60)}`;
      if (!allInsights.some(existing => `${existing.type}:${existing.text.substring(0, 60)}` === key)) {
        allInsights.push(i);
      }
    }

    // Dedup insights
    const dedupedInsights: FestivalInsight[] = [];
    const seenKeys = new Set<string>();
    for (const i of allInsights) {
      const key = `${i.type}:${i.text.substring(0, 60)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        dedupedInsights.push(i);
      }
    }

    // Fetch poster (only call that can't come from full HTML)
    const posterUrl = await fetchPageImage(pageSlug, lang);

    return {
      title,
      lang,
      pageId,
      years: merged,
      sourcePage,
      insights: dedupedInsights.length > 0 ? dedupedInsights : undefined,
      posterUrl,
      location: festivalLocation,
    };
  } catch (err) {
    log.warn(`Failed to parse ${title}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** Merge YearLineup arrays that may have overlapping years — edition-aware */
function mergeYears(years: YearLineup[]): YearLineup[] {
  // Key by year+edition so different editions of the same year stay separate
  const map = new Map<string, { year: number; edition?: string; location?: FestivalLocation; date?: string; dateEnd?: string; artists: Map<string, ArtistEntry> }>();

  for (const yl of years) {
    const key = `${yl.year}::${yl.edition ?? ''}`;
    if (!map.has(key)) {
      map.set(key, { year: yl.year, edition: yl.edition, location: yl.location, date: yl.date, dateEnd: yl.dateEnd, artists: new Map() });
    }
    const bucket = map.get(key)!;
    // Preserve location if set
    if (yl.location && !bucket.location) bucket.location = yl.location;
    if (yl.date && !bucket.date) { bucket.date = yl.date; bucket.dateEnd = yl.dateEnd; }
    for (const a of yl.artists) {
      const aKey = a.name.toLowerCase();
      if (!bucket.artists.has(aKey)) {
        bucket.artists.set(aKey, a);
      }
    }
  }

  const result: YearLineup[] = [];
  for (const entry of map.values()) {
    const artists = Array.from(entry.artists.values());
    if (artists.length > 0) {
      result.push({
        year: entry.year,
        artists,
        edition: entry.edition,
        location: entry.location,
        date: entry.date,
        dateEnd: entry.dateEnd,
      });
    }
  }
  return result.sort((a, b) => a.year - b.year || (a.edition ?? '').localeCompare(b.edition ?? ''));
}
