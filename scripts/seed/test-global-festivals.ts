/**
 * Test lineup parser against 50 diverse festivals globally.
 * Reports: artists count, years, editions, issues found.
 */
import { parseFestivalLineup, type FestivalLineup } from './crawlers/wikipedia-lineup-parser';
import { setVerbose } from './utils/logger';

setVerbose(false);

interface TestFestival {
  name: string;
  langs: string[];
  category: 'large' | 'niche';
  region: string;
}

// 30 Large global festivals
const LARGE_FESTIVALS: TestFestival[] = [
  // Europe
  { name: 'Glastonbury Festival', langs: ['en'], category: 'large', region: 'UK' },
  { name: 'Tomorrowland (festival)', langs: ['en', 'es'], category: 'large', region: 'Belgium' },
  { name: 'Roskilde Festival', langs: ['en', 'da'], category: 'large', region: 'Denmark' },
  { name: 'Reading and Leeds Festivals', langs: ['en'], category: 'large', region: 'UK' },
  { name: 'Sziget Festival', langs: ['en', 'hu'], category: 'large', region: 'Hungary' },
  { name: 'Wacken Open Air', langs: ['en', 'de'], category: 'large', region: 'Germany' },
  { name: 'Rock am Ring and Rock im Park', langs: ['en', 'de'], category: 'large', region: 'Germany' },
  { name: 'Hellfest (French music festival)', langs: ['en', 'fr'], category: 'large', region: 'France' },
  { name: 'Download Festival', langs: ['en'], category: 'large', region: 'UK' },
  { name: 'Pinkpop Festival', langs: ['en', 'nl'], category: 'large', region: 'Netherlands' },
  // Americas
  { name: 'Coachella', langs: ['en', 'es'], category: 'large', region: 'USA' },
  { name: 'Bonnaroo Music Festival', langs: ['en'], category: 'large', region: 'USA' },
  { name: 'Austin City Limits Music Festival', langs: ['en'], category: 'large', region: 'USA' },
  { name: 'Ultra Music Festival', langs: ['en', 'es'], category: 'large', region: 'USA' },
  { name: 'Electric Daisy Carnival', langs: ['en'], category: 'large', region: 'USA' },
  { name: 'Vive Latino', langs: ['en', 'es'], category: 'large', region: 'Mexico' },
  { name: 'Lollapalooza Chile', langs: ['en', 'es'], category: 'large', region: 'Chile' },
  { name: 'Rock al Parque', langs: ['es', 'en'], category: 'large', region: 'Colombia' },
  // Asia
  { name: 'Fuji Rock Festival', langs: ['en', 'ja'], category: 'large', region: 'Japan' },
  { name: 'Summer Sonic', langs: ['en', 'ja'], category: 'large', region: 'Japan' },
  { name: 'Sunburn Festival', langs: ['en'], category: 'large', region: 'India' },
  { name: 'Rainforest World Music Festival', langs: ['en'], category: 'large', region: 'Malaysia' },
  // Australia/Oceania
  { name: 'Splendour in the Grass', langs: ['en'], category: 'large', region: 'Australia' },
  { name: 'Big Day Out', langs: ['en'], category: 'large', region: 'Australia' },
  { name: 'Rhythm and Vines', langs: ['en'], category: 'large', region: 'New Zealand' },
  // Africa
  { name: 'Bushfire Festival', langs: ['en'], category: 'large', region: 'Eswatini' },
  { name: 'Rocking the Daisies', langs: ['en'], category: 'large', region: 'South Africa' },
  { name: 'AfrikaBurn', langs: ['en'], category: 'large', region: 'South Africa' },
  // More Europe
  { name: 'Exit (festival)', langs: ['en', 'sr'], category: 'large', region: 'Serbia' },
  { name: 'NOS Alive', langs: ['en', 'pt'], category: 'large', region: 'Portugal' },
];

// 20 Niche/intermediate festivals
const NICHE_FESTIVALS: TestFestival[] = [
  { name: 'Roadburn Festival', langs: ['en', 'nl'], category: 'niche', region: 'Netherlands' },
  { name: 'Obscene Extreme', langs: ['en', 'cs'], category: 'niche', region: 'Czech Republic' },
  { name: 'Hellfest (French music festival)', langs: ['fr'], category: 'niche', region: 'France' },
  { name: 'Pol\'and\'Rock Festival', langs: ['en', 'pl'], category: 'niche', region: 'Poland' },
  { name: 'Resurrection Fest', langs: ['en', 'es'], category: 'niche', region: 'Spain' },
  { name: 'Teknival', langs: ['en', 'fr'], category: 'niche', region: 'France' },
  { name: 'Melt! (festival)', langs: ['en', 'de'], category: 'niche', region: 'Germany' },
  { name: 'Brutal Assault', langs: ['en', 'cs'], category: 'niche', region: 'Czech Republic' },
  { name: 'Pitchfork Music Festival', langs: ['en'], category: 'niche', region: 'USA' },
  { name: 'Psycho Las Vegas', langs: ['en'], category: 'niche', region: 'USA' },
  { name: 'Desertfest', langs: ['en'], category: 'niche', region: 'Belgium/UK' },
  { name: 'Sonic Blast Moledo', langs: ['en', 'pt'], category: 'niche', region: 'Portugal' },
  { name: 'Barómetro Rock', langs: ['es'], category: 'niche', region: 'Colombia' },
  { name: 'Festival Ceremonia', langs: ['es', 'en'], category: 'niche', region: 'Mexico' },
  { name: 'Personal Fest', langs: ['es', 'en'], category: 'niche', region: 'Argentina' },
  { name: 'Cosquín Rock', langs: ['es', 'en'], category: 'niche', region: 'Argentina' },
  { name: 'Fauna Primavera', langs: ['es', 'en'], category: 'niche', region: 'Chile' },
  { name: 'Corona Capital', langs: ['es', 'en'], category: 'niche', region: 'Mexico' },
  { name: 'Pa\'l Norte', langs: ['es', 'en'], category: 'niche', region: 'Mexico' },
  { name: 'Domination Festival', langs: ['es', 'en'], category: 'niche', region: 'Mexico' },
];

interface TestResult {
  festival: TestFestival;
  bestLang: string;
  totalArtists: number;
  years: number;
  editions: string[];
  yearRange: string;
  perLang: { lang: string; artists: number; years: number }[];
  issues: string[];
}

async function testFestival(fest: TestFestival): Promise<TestResult> {
  const perLang: TestResult['perLang'] = [];
  const issues: string[] = [];
  let bestLineup: FestivalLineup | null = null;
  let bestCount = 0;
  let bestLang = '';

  for (const lang of fest.langs) {
    try {
      const lineup = await parseFestivalLineup(fest.name, lang, 0);
      if (lineup) {
        const count = lineup.years.reduce((s, y) => s + y.artists.length, 0);
        perLang.push({ lang, artists: count, years: lineup.years.length });
        if (count > bestCount) {
          bestLineup = lineup;
          bestCount = count;
          bestLang = lang;
        }
      } else {
        perLang.push({ lang, artists: 0, years: 0 });
      }
    } catch (err) {
      perLang.push({ lang, artists: 0, years: 0 });
      issues.push(`${lang}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Check for potential issues
  if (bestLineup) {
    for (const y of bestLineup.years) {
      // Check for suspicious artist names
      for (const a of y.artists) {
        if (/^\d{4}/.test(a.name)) issues.push(`Year-like artist: "${a.name}" (${y.year})`);
        if (a.name.length > 60) issues.push(`Long name: "${a.name.substring(0, 40)}..." (${y.year})`);
        if (/stage|escenario/i.test(a.name)) issues.push(`Stage as artist: "${a.name}" (${y.year})`);
      }
    }
  }

  const editions = new Set<string>();
  if (bestLineup) {
    for (const y of bestLineup.years) {
      for (const a of y.artists) {
        if (a.edition) editions.add(a.edition);
      }
    }
  }

  return {
    festival: fest,
    bestLang,
    totalArtists: bestCount,
    years: bestLineup?.years.length ?? 0,
    editions: [...editions],
    yearRange: bestLineup ? `${bestLineup.years[0]?.year}–${bestLineup.years.at(-1)?.year}` : 'N/A',
    perLang,
    issues,
  };
}

async function main() {
  const allFestivals = [...LARGE_FESTIVALS, ...NICHE_FESTIVALS];
  // Deduplicate by name (Hellfest appears in both)
  const seen = new Set<string>();
  const festivals = allFestivals.filter(f => {
    const key = f.name + f.langs.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Testing ${festivals.length} festivals...\n`);

  const results: TestResult[] = [];
  for (let i = 0; i < festivals.length; i++) {
    const fest = festivals[i];
    process.stdout.write(`[${i + 1}/${festivals.length}] ${fest.name} (${fest.region})...`);
    const result = await testFestival(fest);
    results.push(result);
    const status = result.totalArtists > 0
      ? `✅ ${result.totalArtists} artists, ${result.years} years [${result.bestLang}]`
      : '❌ No data';
    console.log(` ${status}`);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(80));

  const withData = results.filter(r => r.totalArtists > 0);
  const noData = results.filter(r => r.totalArtists === 0);

  console.log(`\n✅ With lineup data: ${withData.length}/${results.length}`);
  console.log(`❌ No data: ${noData.length}/${results.length}`);

  // Table: festivals with data
  console.log('\n--- FESTIVALS WITH DATA ---');
  console.log('Festival'.padEnd(40) + 'Region'.padEnd(15) + 'Lang'.padEnd(6) + 'Artists'.padEnd(10) + 'Years'.padEnd(8) + 'Range'.padEnd(15) + 'Editions');
  for (const r of withData.sort((a, b) => b.totalArtists - a.totalArtists)) {
    const edStr = r.editions.length > 0 ? r.editions.slice(0, 3).join(', ') + (r.editions.length > 3 ? '...' : '') : '-';
    console.log(
      r.festival.name.substring(0, 38).padEnd(40) +
      r.festival.region.padEnd(15) +
      r.bestLang.padEnd(6) +
      String(r.totalArtists).padEnd(10) +
      String(r.years).padEnd(8) +
      r.yearRange.padEnd(15) +
      edStr
    );
  }

  // Table: no data
  if (noData.length > 0) {
    console.log('\n--- NO DATA ---');
    for (const r of noData) {
      console.log(`  ${r.festival.name} (${r.festival.region}) — tried: ${r.festival.langs.join(', ')}`);
    }
  }

  // Language comparison
  console.log('\n--- LANGUAGE COMPARISON (where multiple langs tried) ---');
  for (const r of results.filter(r => r.perLang.length > 1 && r.perLang.some(p => p.artists > 0))) {
    const langStr = r.perLang.map(p => `${p.lang}:${p.artists}`).join(' vs ');
    console.log(`  ${r.festival.name.substring(0, 35).padEnd(37)} ${langStr}`);
  }

  // Issues
  const withIssues = results.filter(r => r.issues.length > 0);
  if (withIssues.length > 0) {
    console.log('\n--- ISSUES FOUND ---');
    for (const r of withIssues) {
      console.log(`\n  ${r.festival.name}:`);
      for (const issue of r.issues.slice(0, 5)) {
        console.log(`    ⚠ ${issue}`);
      }
      if (r.issues.length > 5) console.log(`    ... +${r.issues.length - 5} more`);
    }
  }

  // Stats
  const totalArtists = withData.reduce((s, r) => s + r.totalArtists, 0);
  const totalYears = withData.reduce((s, r) => s + r.years, 0);
  console.log(`\n--- TOTALS ---`);
  console.log(`Total artists extracted: ${totalArtists}`);
  console.log(`Total year-editions: ${totalYears}`);
  console.log(`Average artists/festival: ${withData.length > 0 ? Math.round(totalArtists / withData.length) : 0}`);
}

main().catch(e => { console.error(e); process.exit(1); });
