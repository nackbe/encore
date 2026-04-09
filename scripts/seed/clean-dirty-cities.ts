/**
 * Clean dirty city data from Wikipedia scraping artifacts.
 * Fixes cities that are actually countries, removes garbage text.
 */
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

// Patterns to clean from city field
const GARBAGE_PATTERNS = [
  /\s*commencing in$/i,
  /\s*todos os anos desde$/i,
  /\s*todos los años desde$/i,
  /\s*behind only CMA Music Festival$/i,
  /\s*in parish of Trinity$/i,
  /\s*every summer$/i,
  /\s*for three days.*$/i,
  /\s*at Flugplatz.*$/i,
  /\s*or a venue in.*$/i,
  /\s*in mid- to late.*$/i,
  /\s*desde el año$/i,
  /\s*in Faroe$/i,
];

// Full garbage city values → set to null
const GARBAGE_CITIES = [
  'Northeast that is usually three or four days long',
  'Europa todos los años desde',
  'North America behind only CMA Music Festival',
  'Dessel todos os anos desde',
];

// Country appearing as city → move to country, set city to null
const COUNTRY_AS_CITY: Record<string, string> = {
  'Japan': 'Japan',
  'Canada': 'Canada',
  'Australia': 'Australia',
  'Serbia': 'Serbia',
  'Portugal': 'Portugal',
  'Czech Republic': 'Czech Republic',
  'Wales': 'United Kingdom',
  'England': 'United Kingdom',
  'Scotland': 'United Kingdom',
  'Romania': 'Romania',
  'South Korea': 'South Korea',
  'Ireland': 'Ireland',
  'Indonesia': 'Indonesia',
  'Thailand': 'Thailand',
  'Norway': 'Norway',
  'Sweden': 'Sweden',
  'Slovakia': 'Slovakia',
};

async function main() {
  let fixed = 0;

  // 1. Fix garbage cities → null
  for (const garbage of GARBAGE_CITIES) {
    const { data, error } = await supabase
      .from('global_events')
      .update({ city: null })
      .eq('city', garbage)
      .select('id');
    const count = data?.length ?? 0;
    if (count > 0) {
      console.log(`  Nulled "${garbage}": ${count} rows`);
      fixed += count;
    }
  }

  // 2. Fix country-as-city → move to country field
  for (const [cityVal, countryVal] of Object.entries(COUNTRY_AS_CITY)) {
    const { data } = await supabase
      .from('global_events')
      .update({ city: null, country: countryVal })
      .eq('city', cityVal)
      .is('country', null)
      .select('id');
    const count = data?.length ?? 0;
    if (count > 0) {
      console.log(`  Moved "${cityVal}" to country: ${count} rows`);
      fixed += count;
    }
  }

  // 3. Clean partial garbage from city names
  // Fetch all cities with garbage patterns and clean them
  const { data: allEvents } = await supabase
    .from('global_events')
    .select('id, city')
    .eq('event_type', 'festival')
    .not('city', 'is', null);

  if (allEvents) {
    for (const event of allEvents) {
      let cleaned = event.city;
      for (const pattern of GARBAGE_PATTERNS) {
        cleaned = cleaned.replace(pattern, '').trim();
      }
      // Also clean "Alice Springs commencing in" → "Alice Springs"
      cleaned = cleaned.replace(/\s+commencing\s+in$/i, '').trim();

      if (cleaned !== event.city && cleaned.length > 0) {
        await supabase.from('global_events').update({ city: cleaned }).eq('id', event.id);
        fixed++;
      } else if (cleaned.length === 0) {
        await supabase.from('global_events').update({ city: null }).eq('id', event.id);
        fixed++;
      }
    }
  }

  // 4. Fix "Canada" appearing as city with actual country in country field
  // e.g. city="Canada", country="Mexico" → should be city=null, keep country
  const { data: canadaRows } = await supabase
    .from('global_events')
    .update({ city: null })
    .eq('city', 'Canada')
    .not('country', 'is', null)
    .select('id');
  if (canadaRows?.length) {
    console.log(`  Fixed "Canada" as city (with real country): ${canadaRows.length} rows`);
    fixed += canadaRows.length;
  }

  // 5. Fix "Hove Festival was discontinued" as country
  const { data: hoveRows } = await supabase
    .from('global_events')
    .update({ country: 'Norway' })
    .eq('country', 'Hove Festival was discontinued')
    .select('id');
  if (hoveRows?.length) {
    console.log(`  Fixed "Hove Festival was discontinued" country: ${hoveRows.length} rows`);
    fixed += hoveRows.length;
  }

  console.log(`\nTotal fixes: ${fixed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
