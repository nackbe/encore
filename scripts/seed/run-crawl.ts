/**
 * Run the Wikipedia festival crawler.
 * Discovers festival pages from all entry point categories,
 * filters edition pages, and deduplicates across languages.
 *
 * Usage: npx tsx scripts/seed/run-crawl.ts [--verbose]
 * Output: scripts/seed/data/festival-index.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WIKI_ENTRY_POINTS } from './config/wiki-entry-points';
import { crawlAllFestivals } from './crawlers/wikipedia-crawler';
import { deduplicateFestivals } from './normalizers/festival-normalizer';
import { createLogger, setVerbose } from './utils/logger';

const log = createLogger('run-crawl');

async function main() {
  const verbose = process.argv.includes('--verbose');
  setVerbose(verbose);

  log.info('=== Wikipedia Festival Crawler ===');
  log.info(`Entry points: ${WIKI_ENTRY_POINTS.length}`);

  const startTime = Date.now();

  // Step 1: Crawl all categories
  const rawPages = await crawlAllFestivals(WIKI_ENTRY_POINTS);

  // Step 2: Normalize and deduplicate
  const festivals = deduplicateFestivals(rawPages);

  // Sort by number of categories (more = more relevant)
  festivals.sort((a, b) => b.allCategories.length - a.allCategories.length);

  // Save to JSON
  const outDir = join(__dirname, 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'festival-index.json');
  writeFileSync(outPath, JSON.stringify(festivals, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Stats
  const langCounts: Record<string, number> = {};
  for (const f of festivals) {
    for (const v of f.variants) {
      langCounts[v.lang] = (langCounts[v.lang] ?? 0) + 1;
    }
  }
  const multiLang = festivals.filter((f) => f.variants.length > 1).length;

  log.info(`=== Crawl Complete ===`);
  log.info(`Raw pages: ${rawPages.length}`);
  log.info(`After dedup: ${festivals.length} unique festivals`);
  log.info(`Multi-language: ${multiLang} festivals with variants`);
  log.info(`Variants by language: ${Object.entries(langCounts).map(([l, c]) => `${l}=${c}`).join(', ')}`);
  log.info(`Time: ${elapsed}s`);
  log.info(`Saved to: ${outPath}`);
}

main().catch((err) => {
  log.error(`Fatal: ${err.message}`);
  process.exit(1);
});
