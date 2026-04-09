import { extractLocationFromTitle } from './crawlers/wikipedia-insights-extractor';

const tests = [
  'Lollapalooza Argentina', 'Lollapalooza Chile', 'Tomorrowland Brasil',
  'Ultra Buenos Aires', 'Ultra Japan', 'Ultra Chile', 'Creamfields BA',
  'Creamfields Perú', 'Creamfields Andalucía', 'Festival Solid Rock (Chile)',
  'México Metal Fest', 'Tokyo Idol Festival', 'Rock in Rio', 'Download Festival', 'Coachella',
  'Lista da programação do Lollapalooza por ano',
];

for (const t of tests) {
  const loc = extractLocationFromTitle(t);
  console.log(t.padEnd(50), '→', loc ? JSON.stringify(loc) : 'null');
}
