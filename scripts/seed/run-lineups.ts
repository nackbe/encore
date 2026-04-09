/**
 * Run the Wikipedia lineup parser on all festivals from the crawl index.
 * Parses lineup data from each festival's Wikipedia page.
 *
 * Usage: npx tsx scripts/seed/run-lineups.ts [--verbose] [--limit N] [--min-categories N] [--resume]
 *
 * Options:
 *   --verbose          Show debug logs
 *   --limit N          Only process first N festivals (for testing)
 *   --min-categories N Only process festivals found in N+ categories (default: 1)
 *   --resume           Skip festivals already in festival-lineups.json
 *
 * Input:  scripts/seed/data/festival-index.json
 * Output: scripts/seed/data/festival-lineups.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parseFestivalLineup, type FestivalLineup, type YearLineup } from './crawlers/wikipedia-lineup-parser';
import type { FestivalInsight } from './crawlers/wikipedia-insights-extractor';
import { extractLocationFromTitle } from './crawlers/wikipedia-insights-extractor';
import { createLogger, createProgress, setVerbose } from './utils/logger';
import type { DeduplicatedFestival } from './normalizers/festival-normalizer';

const log = createLogger('run-lineups');

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    verbose: args.includes('--verbose'),
    resume: args.includes('--resume'),
    limit: (() => {
      const idx = args.indexOf('--limit');
      return idx !== -1 ? parseInt(args[idx + 1], 10) : Infinity;
    })(),
    minCategories: (() => {
      const idx = args.indexOf('--min-categories');
      return idx !== -1 ? parseInt(args[idx + 1], 10) : 1;
    })(),
  };
}

async function main() {
  const { verbose, limit, minCategories, resume } = parseArgs();
  setVerbose(verbose);

  // Load festival index
  const indexPath = join(__dirname, 'data', 'festival-index.json');
  if (!existsSync(indexPath)) {
    log.error('festival-index.json not found. Run crawl first: npx tsx scripts/seed/run-crawl.ts');
    process.exit(1);
  }

  const allFestivals: DeduplicatedFestival[] = JSON.parse(readFileSync(indexPath, 'utf-8'));
  log.info(`Loaded ${allFestivals.length} festivals from index`);

  // Filter by min categories
  const filtered = allFestivals.filter((f) => f.allCategories.length >= minCategories);
  log.info(`After min-categories filter (>=${minCategories}): ${filtered.length}`);

  // Apply limit
  const festivals = filtered.slice(0, limit);
  log.info(`Processing ${festivals.length} festivals`);

  const results: FestivalLineup[] = [];

  // Resume support: load existing results and skip already-processed festivals
  const existingTitles = new Set<string>();
  if (resume) {
    const lineupsPath = join(__dirname, 'data', 'festival-lineups.json');
    if (existsSync(lineupsPath)) {
      const existing: FestivalLineup[] = JSON.parse(readFileSync(lineupsPath, 'utf-8'));
      results.push(...existing);
      for (const l of existing) existingTitles.add(l.title);
      log.info(`Resume: loaded ${existing.length} existing lineups, skipping those`);
    }
  }

  const progress = createProgress('lineups', festivals.length);
  let skipped = 0;
  let failed = 0;
  let noLineup = 0;

  for (const fest of festivals) {
    // Skip already-processed festivals when resuming
    if (existingTitles.has(fest.canonicalTitle)) {
      skipped++;
      progress.tick(fest.canonicalTitle);
      continue;
    }
    // Try all language variants — prefer English first, then others
    // Pick the result with the most artists
    const sortedVariants = [
      ...fest.variants.filter((v) => v.lang === 'en'),
      ...fest.variants.filter((v) => v.lang !== 'en'),
    ];

    // Collect lineups from ALL language variants
    const allLineups: FestivalLineup[] = [];

    for (const variant of sortedVariants) {
      try {
        const lineup = await parseFestivalLineup(variant.title, variant.lang, variant.pageId);
        if (lineup && lineup.years.length > 0) {
          allLineups.push(lineup);
        }
      } catch (err) {
        log.debug(`Error: ${variant.title} [${variant.lang}]: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (allLineups.length === 0) {
      noLineup++;
    } else if (allLineups.length === 1) {
      // Single variant — use as-is
      allLineups[0].title = fest.canonicalTitle;
      // Fallback location from title if not extracted from Wikipedia
      if (!allLineups[0].location) {
        allLineups[0].location = extractLocationFromTitle(fest.canonicalTitle) ?? undefined;
      }
      results.push(allLineups[0]);
    } else {
      // Multiple variants — merge per year+edition, taking the entry with more artists
      const yearBest = new Map<string, { year: YearLineup; lang: string }>();
      for (const lineup of allLineups) {
        for (const yl of lineup.years) {
          const key = `${yl.year}::${yl.edition ?? ''}`;
          const existing = yearBest.get(key);
          if (!existing || yl.artists.length > existing.year.artists.length) {
            yearBest.set(key, { year: yl, lang: lineup.lang });
          }
        }
      }
      const mergedYears = [...yearBest.values()]
        .sort((a, b) => a.year.year - b.year.year || (a.year.edition ?? '').localeCompare(b.year.edition ?? ''))
        .map((v) => v.year);

      // Use the first lineup as base, find which lang contributed most years
      const langCounts = new Map<string, number>();
      for (const v of yearBest.values()) {
        langCounts.set(v.lang, (langCounts.get(v.lang) || 0) + 1);
      }
      const primaryLang = [...langCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

      // Combine insights from all language variants (dedup by type+text)
      const allInsights: FestivalInsight[] = [];
      const seenInsights = new Set<string>();
      for (const lineup of allLineups) {
        for (const insight of lineup.insights ?? []) {
          const key = `${insight.type}:${insight.text.substring(0, 50)}`;
          if (!seenInsights.has(key)) {
            seenInsights.add(key);
            allInsights.push(insight);
          }
        }
      }

      // Pick best poster URL and location from any variant
      const posterUrl = allLineups.find(l => l.posterUrl)?.posterUrl;
      const location = allLineups.find(l => l.location)?.location
        ?? extractLocationFromTitle(fest.canonicalTitle) ?? undefined;

      const merged: FestivalLineup = {
        title: fest.canonicalTitle,
        lang: primaryLang,
        pageId: allLineups[0].pageId,
        years: mergedYears,
        sourcePage: allLineups[0].sourcePage,
        insights: allInsights.length > 0 ? allInsights : undefined,
        posterUrl,
        location,
      };
      results.push(merged);

      const totalMerged = mergedYears.reduce((s, y) => s + y.artists.length, 0);
      log.debug(`Merged ${allLineups.length} variants for ${fest.canonicalTitle}: ${mergedYears.length} years, ${totalMerged} artists`);
    }

    progress.tick(fest.canonicalTitle);

    // Incremental save every 50 festivals (so we don't lose data if interrupted)
    if (results.length > 0 && results.length % 50 === 0) {
      const tmpPath = join(__dirname, 'data', 'festival-lineups.json');
      mkdirSync(join(__dirname, 'data'), { recursive: true });
      writeFileSync(tmpPath, JSON.stringify(results, null, 2));
      log.info(`Incremental save: ${results.length} festivals saved`);
    }
  }

  progress.summary();

  // Sort by number of artists (descending)
  results.sort((a, b) => {
    const aTotal = a.years.reduce((s, y) => s + y.artists.length, 0);
    const bTotal = b.years.reduce((s, y) => s + y.artists.length, 0);
    return bTotal - aTotal;
  });

  // Save results
  const outDir = join(__dirname, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'festival-lineups.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2));

  // Stats
  const totalArtists = results.reduce(
    (sum, f) => sum + f.years.reduce((s, y) => s + y.artists.length, 0), 0
  );
  const totalYears = results.reduce((sum, f) => sum + f.years.length, 0);
  const headliners = results.reduce(
    (sum, f) => sum + f.years.reduce((s, y) => s + y.artists.filter((a) => a.isHeadliner).length, 0), 0
  );

  log.info('=== Lineup Parsing Complete ===');
  log.info(`Processed: ${festivals.length} festivals`);
  log.info(`With lineups: ${results.length}`);
  log.info(`No lineup data: ${noLineup}`);
  log.info(`Failed: ${failed}`);
  log.info(`Total artist entries: ${totalArtists}`);
  log.info(`Total year-editions: ${totalYears}`);
  log.info(`Headliners: ${headliners}`);
  const totalInsights = results.reduce((sum, f) => sum + (f.insights?.length ?? 0), 0);
  const withInsights = results.filter(f => f.insights && f.insights.length > 0).length;
  log.info(`Insights: ${totalInsights} across ${withInsights} festivals`);
  const withPoster = results.filter(f => f.posterUrl).length;
  log.info(`With poster/logo: ${withPoster}/${results.length}`);
  const withLocation = results.filter(f => f.location).length;
  log.info(`With location: ${withLocation}/${results.length}`);
  const editionYears = results.reduce((sum, f) => sum + f.years.filter(y => y.edition).length, 0);
  const yearLocations = results.reduce((sum, f) => sum + f.years.filter(y => y.location).length, 0);
  const preciseDates = results.reduce((sum, f) => sum + f.years.filter(y => y.date && !y.date.endsWith('-01-01')).length, 0);
  const artistInsights = results.reduce((sum, f) => sum + (f.insights?.filter(i => i.artistName)?.length ?? 0), 0);
  log.info(`Year-editions (multi-city): ${editionYears}`);
  log.info(`Per-year locations: ${yearLocations}`);
  log.info(`Precise dates: ${preciseDates}`);
  log.info(`Artist-specific insights: ${artistInsights}`);
  log.info(`Saved to: ${outPath}`);

  // Top 10 festivals by artist count
  log.info('\nTop 10 festivals by artist count:');
  for (const f of results.slice(0, 10)) {
    const total = f.years.reduce((s, y) => s + y.artists.length, 0);
    const yearRange = `${f.years[0]?.year}–${f.years.at(-1)?.year}`;
    log.info(`  ${f.title}: ${total} artists, ${f.years.length} years (${yearRange})`);
  }
}

main().catch((err) => {
  log.error(`Fatal: ${err.message}`);
  process.exit(1);
});
