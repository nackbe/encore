import { parseFestivalLineup } from './crawlers/wikipedia-lineup-parser';

const title = process.argv[2] || 'Welcome to Rockville';
const lang = process.argv[3] || 'en';
const yearFilter = process.argv[4] ? parseInt(process.argv[4]) : null;

async function main() {
  const r = await parseFestivalLineup(title, lang, 0);
  if (!r) { console.log('No lineup data found'); return; }

  for (const y of r.years) {
    if (yearFilter && y.year !== yearFilter) continue;
    console.log(`\n=== ${y.year} (${y.artists.length} artists) ===`);
    for (const a of y.artists) {
      const parts = [a.isHeadliner ? '★' : ' ', a.name];
      if (a.stage) parts.push(`[${a.stage}]`);
      if (a.day) parts.push(`(${a.day})`);
      if (a.edition) parts.push(`{${a.edition}}`);
      console.log(parts.join(' '));
    }
  }
}
main().catch(e => console.error(e));
