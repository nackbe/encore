/**
 * Test the lineup parser with a few well-known festivals.
 * Quick validation before running on the full index.
 *
 * Usage: npx tsx scripts/seed/run-test-lineups.ts [--verbose]
 */

import { parseFestivalLineup } from './crawlers/wikipedia-lineup-parser';
import { setVerbose } from './utils/logger';

const TEST_FESTIVALS = [
  // Pattern: section with <ul> per year + redirect to lineup page
  { title: 'Festival Estéreo Picnic', lang: 'en', pageId: 0 },
  // Pattern: tables with stage columns (via redirect page)
  { title: 'Coachella Valley Music and Arts Festival', lang: 'en', pageId: 0 },
  // Pattern: <ul> lists with stage labels (via per-year pages)
  { title: 'Bonnaroo Music Festival', lang: 'en', pageId: 0 },
  // Pattern: Spanish, <ul> with category labels
  { title: 'Rock al Parque', lang: 'es', pageId: 0 },
  // Pattern: redirect to dedicated lineup page
  { title: 'Lollapalooza', lang: 'en', pageId: 0 },
  // Pattern: summary table (headliners only)
  { title: 'Primavera Sound', lang: 'en', pageId: 0 },
];

async function main() {
  const verbose = process.argv.includes('--verbose');
  setVerbose(verbose);

  console.log('=== Lineup Parser Test ===\n');

  for (const fest of TEST_FESTIVALS) {
    console.log(`\n--- ${fest.title} [${fest.lang}] ---`);
    const start = Date.now();

    const result = await parseFestivalLineup(fest.title, fest.lang, fest.pageId);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (!result) {
      console.log(`  ❌ No lineup data found (${elapsed}s)`);
      continue;
    }

    console.log(`  Source: ${result.sourcePage}`);
    console.log(`  Years: ${result.years.length} (${result.years[0]?.year}–${result.years.at(-1)?.year})`);

    const totalArtists = result.years.reduce((s, y) => s + y.artists.length, 0);
    const headliners = result.years.reduce(
      (s, y) => s + y.artists.filter((a) => a.isHeadliner).length, 0
    );
    console.log(`  Total artists: ${totalArtists}, Headliners: ${headliners}`);
    console.log(`  Time: ${elapsed}s`);

    // Show sample from most recent year
    const latest = result.years.at(-1);
    if (latest) {
      console.log(`  Latest year (${latest.year}): ${latest.artists.length} artists`);
      const sample = latest.artists.slice(0, 8).map((a) =>
        a.isHeadliner ? `**${a.name}**` : a.name
      );
      console.log(`    Sample: ${sample.join(', ')}${latest.artists.length > 8 ? '...' : ''}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
