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
  const { count: total } = await supabase
    .from('global_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'festival');

  const { count: noLat } = await supabase
    .from('global_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'festival')
    .is('lat', null);

  const { count: hasLat } = await supabase
    .from('global_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'festival')
    .not('lat', 'is', null);

  const { count: hasCity } = await supabase
    .from('global_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'festival')
    .not('city', 'is', null);

  console.log(`Total festivals: ${total}`);
  console.log(`With lat/lng:    ${hasLat}`);
  console.log(`Without lat/lng: ${noLat}`);
  console.log(`With city:       ${hasCity}`);

  // Sample some with city but no lat
  const { data: sample } = await supabase
    .from('global_events')
    .select('name, city, country, lat, lng')
    .eq('event_type', 'festival')
    .is('lat', null)
    .not('city', 'is', null)
    .limit(10);

  console.log('\nSample (city but no lat/lng):');
  for (const e of sample ?? []) {
    console.log(`  ${e.name} | ${e.city}, ${e.country}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
