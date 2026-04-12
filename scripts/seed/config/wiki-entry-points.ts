/**
 * Wikipedia category entry points for the festival crawler.
 *
 * The crawler starts from these root categories and recurses into subcategories
 * up to a configurable depth (default: 5). Each category contains either
 * festival article pages or deeper subcategories.
 *
 * Categories are organized by language (en/es/pt) to maximize coverage
 * for Latin American, Spanish, and global festivals.
 */

export interface WikiEntryPoint {
  /** Wikipedia category name (without "Category:" prefix) */
  category: string;
  /** Wikipedia language code */
  lang: 'en' | 'es' | 'pt';
  /** Maximum recursion depth for this category */
  maxDepth: number;
  /** Optional label for logging */
  label?: string;
}

export const WIKI_ENTRY_POINTS: WikiEntryPoint[] = [
  // ─── English Wikipedia (broadest coverage) ──────────────────

  // Global top-level
  { category: 'Music_festivals_by_country', lang: 'en', maxDepth: 4, label: 'Global festivals by country' },
  { category: 'Rock_festivals', lang: 'en', maxDepth: 3, label: 'Rock festivals' },
  { category: 'Electronic_music_festivals', lang: 'en', maxDepth: 3, label: 'Electronic festivals' },
  { category: 'Pop_music_festivals', lang: 'en', maxDepth: 3, label: 'Pop festivals' },
  { category: 'Heavy_metal_festivals', lang: 'en', maxDepth: 3, label: 'Metal festivals' },
  { category: 'Jazz_festivals', lang: 'en', maxDepth: 3, label: 'Jazz festivals' },
  { category: 'Hip_hop_music_festivals', lang: 'en', maxDepth: 3, label: 'Hip hop festivals' },
  { category: 'Folk_festivals', lang: 'en', maxDepth: 3, label: 'Folk festivals' },
  { category: 'Reggae_festivals', lang: 'en', maxDepth: 3, label: 'Reggae festivals' },
  { category: 'Punk_rock_festivals', lang: 'en', maxDepth: 3, label: 'Punk festivals' },
  { category: 'World_music_festivals', lang: 'en', maxDepth: 3, label: 'World music festivals' },
  { category: 'Classical_music_festivals', lang: 'en', maxDepth: 3, label: 'Classical festivals' },
  { category: 'Country_music_festivals', lang: 'en', maxDepth: 3, label: 'Country festivals' },
  { category: 'Blues_festivals', lang: 'en', maxDepth: 3, label: 'Blues festivals' },
  { category: 'Indie_rock_festivals', lang: 'en', maxDepth: 3, label: 'Indie rock festivals' },
  { category: 'Music_festivals_established_in_the_2020s', lang: 'en', maxDepth: 2, label: 'New festivals (2020s)' },
  { category: 'Music_festivals_established_in_the_2010s', lang: 'en', maxDepth: 2, label: 'New festivals (2010s)' },

  // Americas — specific
  { category: 'Music_festivals_in_the_United_States', lang: 'en', maxDepth: 3, label: 'US festivals' },
  { category: 'Music_festivals_in_Mexico', lang: 'en', maxDepth: 3, label: 'Mexico festivals' },
  { category: 'Music_festivals_in_Colombia', lang: 'en', maxDepth: 3, label: 'Colombia festivals' },
  { category: 'Music_festivals_in_Brazil', lang: 'en', maxDepth: 3, label: 'Brazil festivals' },
  { category: 'Music_festivals_in_Argentina', lang: 'en', maxDepth: 3, label: 'Argentina festivals' },
  { category: 'Music_festivals_in_Chile', lang: 'en', maxDepth: 3, label: 'Chile festivals' },
  { category: 'Music_festivals_in_Peru', lang: 'en', maxDepth: 3, label: 'Peru festivals' },
  { category: 'Music_festivals_in_Canada', lang: 'en', maxDepth: 3, label: 'Canada festivals' },

  // Europe — key markets
  { category: 'Music_festivals_in_the_United_Kingdom', lang: 'en', maxDepth: 3, label: 'UK festivals' },
  { category: 'Music_festivals_in_Spain', lang: 'en', maxDepth: 3, label: 'Spain festivals' },
  { category: 'Music_festivals_in_Germany', lang: 'en', maxDepth: 3, label: 'Germany festivals' },
  { category: 'Music_festivals_in_France', lang: 'en', maxDepth: 3, label: 'France festivals' },
  { category: 'Music_festivals_in_the_Netherlands', lang: 'en', maxDepth: 3, label: 'Netherlands festivals' },
  { category: 'Music_festivals_in_Belgium', lang: 'en', maxDepth: 3, label: 'Belgium festivals' },
  { category: 'Music_festivals_in_Italy', lang: 'en', maxDepth: 3, label: 'Italy festivals' },
  { category: 'Music_festivals_in_Portugal', lang: 'en', maxDepth: 3, label: 'Portugal festivals' },

  // Asia & Oceania
  { category: 'Music_festivals_in_Japan', lang: 'en', maxDepth: 3, label: 'Japan festivals' },
  { category: 'Music_festivals_in_Australia', lang: 'en', maxDepth: 3, label: 'Australia festivals' },
  { category: 'Music_festivals_in_South_Korea', lang: 'en', maxDepth: 3, label: 'South Korea festivals' },

  // ─── Spanish Wikipedia (Latin America coverage) ─────────────

  { category: 'Festivales_de_música', lang: 'es', maxDepth: 4, label: 'ES: Festivales de música' },
  { category: 'Festivales_de_rock', lang: 'es', maxDepth: 4, label: 'ES: Festivales de rock' },
  { category: 'Festivales_de_música_electrónica', lang: 'es', maxDepth: 3, label: 'ES: Festivales electrónica' },
  { category: 'Festivales_de_música_de_Colombia', lang: 'es', maxDepth: 3, label: 'ES: Colombia' },
  { category: 'Festivales_de_música_de_México', lang: 'es', maxDepth: 3, label: 'ES: México' },
  { category: 'Festivales_de_música_de_Argentina', lang: 'es', maxDepth: 3, label: 'ES: Argentina' },
  { category: 'Festivales_de_música_de_Chile', lang: 'es', maxDepth: 3, label: 'ES: Chile' },
  { category: 'Festivales_de_música_de_España', lang: 'es', maxDepth: 3, label: 'ES: España' },
  { category: 'Festivales_de_música_de_Perú', lang: 'es', maxDepth: 3, label: 'ES: Perú' },
  // Direct subcategory entry points to avoid depth-limit misses
  { category: 'Festivales_de_rock_de_España', lang: 'es', maxDepth: 1, label: 'ES: Rock España (directo)' },
  { category: 'Festivales_de_rock_de_Colombia', lang: 'es', maxDepth: 1, label: 'ES: Rock Colombia (directo)' },
  { category: 'Festivales_de_rock_de_México', lang: 'es', maxDepth: 1, label: 'ES: Rock México (directo)' },
  { category: 'Festivales_de_rock_de_Argentina', lang: 'es', maxDepth: 1, label: 'ES: Rock Argentina (directo)' },
  { category: 'Festivales_de_rock_de_Chile', lang: 'es', maxDepth: 1, label: 'ES: Rock Chile (directo)' },
  { category: 'Festivales_de_rock_de_Perú', lang: 'es', maxDepth: 1, label: 'ES: Rock Perú (directo)' },

  // ─── Portuguese Wikipedia (Brazil coverage) ─────────────────

  { category: 'Festivais_de_música', lang: 'pt', maxDepth: 4, label: 'PT: Festivais de música' },
  { category: 'Festivais_de_música_do_Brasil', lang: 'pt', maxDepth: 3, label: 'PT: Brasil' },
  { category: 'Festivais_de_rock', lang: 'pt', maxDepth: 3, label: 'PT: Festivais de rock' },
];
