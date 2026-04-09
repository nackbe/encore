import { extractLocation } from './crawlers/wikipedia-insights-extractor';
import { rateLimitedFetch } from './utils/rate-limiter';
import * as cheerio from 'cheerio';

async function fetchIntro(page: string, lang = 'en') {
  const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({
    action: 'parse', page, prop: 'text', section: '0', redirects: '1', format: 'json'
  });
  const res = await rateLimitedFetch('wikipedia', url);
  const data = await res.json() as { parse: { text: { '*': string } } };
  return data.parse.text['*'];
}

async function main() {
  const testPages = [
    'Big Day Out', 'Nova Rock Festival', 'Bonnaroo Music Festival',
  ];

  for (const page of testPages) {
    console.log(`\n${'='.repeat(60)}\n${page}\n${'='.repeat(60)}`);
    const html = await fetchIntro(page);
    const $ = cheerio.load(html);

    const $$ = cheerio.load(html);
    const firstP = $$('p').not('.mw-empty-elt').first().text().trim().substring(0, 250);
    const location = extractLocation(html);
    if (!location) console.log(`  First P: "${firstP}"`);
    console.log(`Location: ${location ? JSON.stringify(location) : 'NOT FOUND'}`);
  }
}
main().catch(console.error);
