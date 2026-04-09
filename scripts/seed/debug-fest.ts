import { parseFestivalLineup } from './crawlers/wikipedia-lineup-parser';

const title = process.argv[2] || 'Knotfest';
const lang = process.argv[3] || 'en';

async function main() {
  const r = await parseFestivalLineup(title, lang, 0);
  if (r) {
    for (const y of r.years) {
      const editions = new Set(y.artists.map(a => a.edition).filter(Boolean));
      console.log(`\nYear ${y.year}: ${y.artists.length} artists | editions: [${[...editions].join(', ')}]`);
      // Group by edition
      const byEdition = new Map<string, typeof y.artists>();
      for (const a of y.artists) {
        const key = a.edition || '(no edition)';
        if (!byEdition.has(key)) byEdition.set(key, []);
        byEdition.get(key)!.push(a);
      }
      for (const [ed, artists] of byEdition) {
        console.log(`  ${ed}: ${artists.length} artists`);
        for (const a of artists.slice(0, 5)) {
          console.log(`    - ${a.name}${a.isHeadliner ? ' ★' : ''}`);
        }
        if (artists.length > 5) console.log(`    ... +${artists.length - 5} more`);
      }
    }
    const total = r.years.reduce((s: number, y: any) => s + y.artists.length, 0);
    console.log(`\nTOTAL: ${total} artists, ${r.years.length} years`);
  } else {
    console.log('No lineup data found');
  }
}

main().catch((e) => console.error(e));
