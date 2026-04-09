import { parseFestivalLineup } from './crawlers/wikipedia-lineup-parser';

const title = process.argv[2] || 'Rock in Rio';
const lang = process.argv[3] || 'en';

async function main() {
  console.log(`Parsing ${title} [${lang}]...\n`);
  const r = await parseFestivalLineup(title, lang, 0);
  if (!r) {
    console.log('No data found');
    return;
  }

  console.log(`${r.years.length} years, ${r.years.reduce((s, y) => s + y.artists.length, 0)} artists\n`);

  if (r.insights && r.insights.length > 0) {
    console.log(`=== ${r.insights.length} INSIGHTS ===\n`);
    // Group by type
    const byType = new Map<string, typeof r.insights>();
    for (const i of r.insights) {
      if (!byType.has(i.type)) byType.set(i.type, []);
      byType.get(i.type)!.push(i);
    }
    for (const [type, insights] of byType) {
      console.log(`--- ${type.toUpperCase()} (${insights.length}) ---`);
      for (const i of insights) {
        const ctx = [i.year ? `${i.year}` : '', i.edition || ''].filter(Boolean).join(' ');
        console.log(`  ${ctx ? `[${ctx}] ` : ''}${i.text.substring(0, 150)}`);
      }
      console.log();
    }
  } else {
    console.log('No insights extracted.');
  }
}
main().catch(e => console.error(e));
