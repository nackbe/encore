# Encore — Project Guide for Claude

## What is this project
Music event collection app. Users register concerts and festivals they've attended. Built with Next.js 14, Supabase, TypeScript, Tailwind.

## Image cascade decisions (IMPORTANT — do not change order)

### Festival card image (`CollectionGrid.tsx → getEventImage`)
1. `global_events.lineup_image_url` — cartel (preferred)
2. `global_events.poster_url` — logo scraped by DuckDuckGo via `scripts/seed/run-festival-images.ts`
3. Fallback: `image_url` of the **first artist alphabetically** from `user_event_artists`

Wikipedia `pageimages` API returns generic crowd photos — all look the same. DuckDuckGo logo search gets real festival branding. Sort artists alphabetically before picking fallback (`localeCompare`), never rely on DB insertion order.

### Concert card image
1. First artist alphabetically with an image
2. `global_events.poster_url` as last resort

### Artist `image_url` pipeline (`src/lib/api/image-cascade.ts`)
1. DB cache (free, instant)
2. fanart.tv (by MusicBrainz ID) — best quality
3. Spotify search — artist profile photo
4. Ticketmaster attractions — can mismatch, last resort
5. null → placeholder SVG

Script to batch-fill missing artist images: `scripts/seed/run-artist-images.ts`

## Festival image scripts (ALREADY EXIST — use them)

`scripts/seed/run-festival-images.ts` — fetches BOTH images per festival via DuckDuckGo:
- `poster_url` (logo card): query `"<festival> festival musica <city> <year>"`
- `lineup_image_url` (cartel): query `"<festival> festival lineup cartel <city> <year>"`

```bash
npx tsx scripts/seed/run-festival-images.ts --type both --limit 500
npx tsx scripts/seed/run-festival-images.ts --type logo   # only logos
npx tsx scripts/seed/run-festival-images.ts --type lineup # only carteles
```
Skips festivals that already have the image. Ordered date DESC — very old festivals need higher `--limit`.

## Festival data pipeline (in order)

```
run-crawl.ts          → festival-index.json    (discovers festivals from Wikipedia categories)
run-lineups.ts        → festival-lineups.json  (parses lineup per festival; use --resume to continue)
run-load-supabase.ts  → DB                     (loads lineups JSON into Supabase)
run-festival-images.ts → DB poster_url         (DuckDuckGo logo images for festivals)
run-artist-images.ts  → DB artists.image_url   (fanart/Spotify images for artists)
run-geocode.ts        → DB lat/lng             (geocodes events missing coordinates)
```

To seed a single festival not found by crawler:
```
npm run seed:festival "Festival Name" en
npm run seed:festival "Festival Name" es --dry-run
```

## City normalization
Always use `normalizeText()` from `@/lib/utils` for city comparisons (strips accents, lowercases).
"Bogotá" and "Bogota" must group to the same map point and city count. Key files: `ConcertMap.tsx`, `stats/page.tsx`.

## Wikipedia scraper notes
- Entry points: `scripts/seed/config/wiki-entry-points.ts`
- English: `Music_festivals_in_the_United_Kingdom` at maxDepth:3 reaches London festivals at depth 3
- Festivals missing from crawler (no Wikipedia music categories) → use `seed-festival.ts` directly
- BST correct title: `British Summer Time (concerts)` (not "festival")
- Location extraction: venue-keyword patterns + CITY_MAP fallback scan (sorted by key length desc to match longest first)

## Build / Vercel
- `tsconfig.json` excludes `"scripts"` — critical, otherwise Vercel type-checks seed scripts and fails
- Seed scripts use `dotenv` + `.env.local`, not the Next.js env system

## Supabase tables
- `global_events` — festival/concert catalog (source: wikipedia, setlistfm, ticketmaster)
- `user_events` — user's attendance records, FK to global_events (nullable for custom events)
- `user_event_artists` — artists the user saw at an event
- `global_event_artists` — canonical artist lineups from seed data
- `artists` — artist catalog with `name_normalized` (accent-stripped) as unique key

## Search
`src/lib/api/unified-search.ts` — combines Supabase full-text, Setlist.fm, Ticketmaster. Location parsing strips city from query for better matching.
