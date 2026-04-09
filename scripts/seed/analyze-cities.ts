import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '..', '..', '.env.local') });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Get all festivals without lat/lng that have a city
  const all: Array<{ city: string; country: string | null }> = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('global_events')
      .select('city, country')
      .eq('event_type', 'festival')
      .is('lat', null)
      .not('city', 'is', null)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data as Array<{ city: string; country: string | null }>);
    page++;
  }

  // Count unique city values
  const cityCounts = new Map<string, number>();
  for (const e of all) {
    const key = `${e.city} | ${e.country ?? '?'}`;
    cityCounts.set(key, (cityCounts.get(key) ?? 0) + 1);
  }

  // Sort by count descending
  const sorted = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Known countries that appear as "city"
  const COUNTRIES = new Set([
    'japan', 'canada', 'australia', 'brazil', 'brasil', 'germany', 'france',
    'italy', 'spain', 'mexico', 'united states', 'united kingdom', 'uk',
    'sweden', 'norway', 'denmark', 'finland', 'netherlands', 'belgium',
    'austria', 'switzerland', 'portugal', 'poland', 'czech republic',
    'hungary', 'romania', 'croatia', 'serbia', 'greece', 'turkey',
    'south korea', 'china', 'india', 'indonesia', 'thailand',
    'new zealand', 'south africa', 'colombia', 'argentina', 'chile',
    'peru', 'ecuador', 'venezuela', 'costa rica', 'ireland',
    'scotland', 'wales', 'england',
  ]);

  console.log('=== COUNTRIES APPEARING AS CITY (can use capital) ===\n');
  const countryAsCities: string[] = [];
  for (const [key, count] of sorted) {
    const city = key.split(' | ')[0].toLowerCase().trim();
    if (COUNTRIES.has(city)) {
      console.log(`  ${key} (${count}x)`);
      countryAsCities.push(key);
    }
  }

  console.log('\n=== DIRTY/GARBAGE CITY DATA (long strings, sentences) ===\n');
  for (const [key, count] of sorted) {
    const city = key.split(' | ')[0];
    if (city.length > 40 || /\b(the|from|since|every|between|behind|commencing|editions?|años?|todos)\b/i.test(city)) {
      console.log(`  ${key} (${count}x)`);
    }
  }

  console.log('\n=== TOP 50 UNMATCHED CITIES (by frequency) ===\n');
  let shown = 0;
  for (const [key, count] of sorted) {
    if (shown >= 50) break;
    const city = key.split(' | ')[0].toLowerCase().trim();
    if (COUNTRIES.has(city)) continue;
    if (key.split(' | ')[0].length > 40) continue;
    console.log(`  ${key} (${count}x)`);
    shown++;
  }

  console.log(`\nTotal ungeolocated with city: ${all.length}`);
  console.log(`Unique city+country combos: ${cityCounts.size}`);
}

main().catch(e => { console.error(e); process.exit(1); });
