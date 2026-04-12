/**
 * Extract festival insights/highlights from Wikipedia HTML prose.
 * Runs on the same section HTML already fetched by the lineup parser.
 *
 * Extracts: attendance, first edition info, records, cancellations,
 * ticket prices, duration, notable moments, venue facts.
 */
import * as cheerio from 'cheerio';

// ─── Types ──────────────────────────────────────────────────

export type InsightType =
  // ── Festival-level ──
  | 'attendance'        // "1.38 million people attended"
  | 'first_edition'     // "the first edition", "inaugural"
  | 'record'            // "Guinness World Record", "largest ever", "first time"
  // cancellation removed — user prefers positive insights only
  | 'ticket_price'      // "$250", "£1", "free admission"
  | 'duration'          // "10-day festival", "3 days"
  | 'venue'             // "250,000 m²", "Cidade do Rock"
  // weather and incident removed — user prefers positive insights only
  // ── Artist-centric (positive/celebratory only) ──
  | 'last_performance'  // "final performance", "farewell", "last concert"
  | 'comeback'          // "reunion", "returned after", "first time since"
  | 'debut'             // "first appearance", "debut"
  | 'notable_moment'    // Surprises, proposals, iconic sets
  | 'surprise_guest'    // Unannounced artist joins stage
  | 'collaboration'     // Two artists perform together on stage
  | 'tribute'           // Tribute to artist (positive remembrance)
  | 'iconic_set';       // Widely regarded as legendary/historic performance

export interface FestivalInsight {
  year?: number;
  edition?: string;
  type: InsightType;
  text: string;          // Clean extracted text
  /** Artist name associated with this insight, if detectable */
  artistName?: string;
  source: 'prose' | 'infobox' | 'table';
}

// ─── Extraction Patterns ────────────────────────────────────

interface InsightPattern {
  type: InsightType;
  // Regex to find the insight in plain text
  patterns: RegExp[];
  // How much context to capture around the match (chars before/after)
  contextBefore?: number;
  contextAfter?: number;
  // Optional transform to clean the extracted text
  transform?: (match: RegExpMatchArray, context: string) => string | null;
}

const INSIGHT_PATTERNS: InsightPattern[] = [
  // ═══════════════════════════════════════════════════════════
  // FESTIVAL-LEVEL INSIGHTS
  // ═══════════════════════════════════════════════════════════

  // ── Attendance ──
  {
    type: 'attendance',
    patterns: [
      /(?:about|approximately|around|over|nearly|more than|an estimated)?\s*([\d,.]+)\s*(?:million|thousand)?\s*(?:people|spectators|attendees|fans|visitors|persons)\s*(?:attended|visited|came|were present|gathered)/i,
      /(?:attendance|crowd|audience)\s*(?:of|was|reached|peaked at|:)\s*([\d,.]+\s*(?:million|thousand)?)/i,
      /(?:drew|attracted|hosted|welcomed|saw)\s*(?:about|over|nearly|more than|an estimated)?\s*([\d,.]+\s*(?:million|thousand)?)\s*(?:people|spectators|attendees|fans|visitors)/i,
      /(?:asistieron|asistencia|concurrieron|congregaron)\s*(?:alrededor de|cerca de|más de|aproximadamente)?\s*([\d,.]+\s*(?:millones?|mil)?)\s*(?:personas|espectadores|asistentes)/i,
      /(?:público|audiencia)\s+(?:de\s+)?(?:más de|alrededor de|cerca de)?\s*([\d,.]+\s*(?:millones?|mil)?)\s*(?:personas|espectadores)?/i,
    ],
    contextAfter: 30,
  },

  // ── First Edition ──
  {
    type: 'first_edition',
    patterns: [
      /(?:the\s+)?(?:first|inaugural|1st)\s+(?:edition|festival|event|year)\s+(?:of\s+(?:the\s+)?(?:festival\s+)?)?(?:was\s+held|took\s+place|happened|occurred)\s+(?:(?:from|on|in|between)\s+)?([^.]{10,80})/i,
      /(?:la\s+)?(?:primera|1\.?ª?)\s+(?:edición|versión|festival)\s+(?:se\s+)?(?:realizó|celebró|llevó a cabo|tuvo lugar)\s+(?:(?:entre|el|en|del)\s+)?([^.]{10,80})/i,
      /(?:founded|established|created|started|begun)\s+(?:in|by)\s+([^.]{5,60})/i,
    ],
    contextAfter: 50,
    transform: (match) => match[0].replace(/\s+/g, ' ').trim(),
  },

  // ── Records ──
  {
    type: 'record',
    patterns: [
      /guinness\s+(?:world\s+)?record/i,
      /(?:largest|biggest|longest|most\s+\w+)\s+(?:ever|in\s+history|in\s+the\s+world|of\s+all\s+time)/i,
      /(?:first\s+(?:ever|time)\s+(?:in|at|that|a))\s+([^.]{5,80})/i,
      /(?:broke|set|established|achieved)\s+(?:a|the|new)?\s*record/i,
      /récord|más\s+grande|más\s+largo|por\s+primera\s+vez/i,
      /(?:sold\s+out|agotó\s+(?:las\s+)?entradas)\s+(?:in|en)\s+(?:record|récord|minutes?|minutos?|hours?|horas?|seconds?|segundos?)/i,
    ],
    contextBefore: 20,
    contextAfter: 60,
  },


  // ── Ticket Price ──
  {
    type: 'ticket_price',
    patterns: [
      /tickets?\s+(?:were|was|cost|priced\s+at|sold\s+(?:for|at))\s+([$€£¥]\s?[\d,.]+(?:\s*(?:million|thousand|USD|EUR|GBP))?)/i,
      /(?:ticket\s+)?price\s*(?:was|:)\s*([$€£¥]\s?[\d,.]+)/i,
      /(?:entradas?|boletos?)\s+(?:costaban?|a)\s+([$€£¥]?\s?[\d,.]+\s*(?:dólares|euros|pesos)?)/i,
      /\(equivalent\s+to\s+([$€£¥][\d,.]+)\s+in\s+\d{4}\)/i,
      /free\s+(?:admission|entry|entrance|festival)/i,
    ],
    contextBefore: 20,
    contextAfter: 40,
  },

  // ── Duration ──
  {
    type: 'duration',
    patterns: [
      /(\d+)[- ]day[- ](?:long\s+)?(?:festival|event|concert)/i,
      /(?:lasted|running|spanning|over)\s+(\d+)\s+days/i,
      /(?:from|between)\s+(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i,
      /(\d+)\s+días?\s+(?:de\s+)?(?:festival|evento|duración)/i,
    ],
    contextAfter: 20,
  },

  // ── Venue / Size ──
  {
    type: 'venue',
    patterns: [
      /([\d,.]+)\s*(?:m²|square\s+(?:meters?|metres?|feet)|hectares?|acres?)/i,
      /(?:capacity|capacidad)\s+(?:of|for|para|de)\s+([\d,.]+)\s*(?:people|persons|personas|espectadores)?/i,
    ],
    contextBefore: 20,
    contextAfter: 30,
  },


  // NOTE: incident, death, controversy, protest, replacement patterns removed
  // — user prefers positive/celebratory insights only

  // ═══════════════════════════════════════════════════════════
  // ARTIST-CENTRIC INSIGHTS
  // ═══════════════════════════════════════════════════════════

  // ── Last Performance / Farewell ──
  {
    type: 'last_performance',
    patterns: [
      /(?:final|last|farewell|goodbye|despedida)\s+(?:performance|concert|show|tour|gig|presentación|concierto)/i,
      /(?:performed|played|appeared)\s+(?:for\s+)?(?:the\s+)?(?:last|final)\s+time/i,
      /(?:last|final)\s+(?:ever\s+)?(?:live|public)\s+(?:performance|appearance|show)/i,
      /(?:última|final)\s+(?:presentación|actuación|aparición)\s+(?:en\s+vivo|pública)/i,
      /would\s+(?:never|not)\s+(?:again\s+)?(?:perform|play|tour)\s+(?:live|again|together)/i,
      /(?:disbanded|broke\s+up|split\s+up)\s+(?:shortly\s+)?(?:after|following)/i,
    ],
    contextBefore: 60,
    contextAfter: 60,
  },


  // ── Comeback / Reunion ──
  {
    type: 'comeback',
    patterns: [
      /(?:reunion|reunión|comeback|regreso)\s+(?:performance|show|tour|concert|gig|after)/i,
      /(?:returned?|regres[óa]|volvi[óe]ron)\s+(?:to\s+(?:the\s+)?stage|after|tras)\s+([^.]{5,60})/i,
      /(?:first\s+(?:time|appearance|show|concert|performance)\s+(?:since|in|después\s+de))\s+([^.]{5,60})/i,
      /(?:reunited|reformed)\s+(?:for|at|in|after)\s+([^.]{5,40})/i,
      /(?:hiatus|break|absence|ausencia)\s+(?:of\s+)?(\d+)\s+(?:years?|años?)/i,
      /hadn'?t\s+(?:performed|played|toured)\s+(?:together\s+)?(?:since|in|for)\s+([^.]{5,40})/i,
    ],
    contextBefore: 60,
    contextAfter: 60,
  },

  // ── Debut ──
  {
    type: 'debut',
    patterns: [
      /(?:first\s+(?:ever\s+)?(?:appearance|performance|show|gig|concert))\s+(?:at|in|outside|on)\s+([^.]{5,60})/i,
      /(?:made\s+(?:their|his|her|its)\s+)?debut\s+(?:at|in|performance|appearance)/i,
      /(?:primera\s+(?:vez|aparición|presentación))\s+(?:en|fuera\s+de)\s+([^.]{5,60})/i,
      /(?:introduced|revealed|unveiled|launched|presented)\s+(?:their|his|her)\s+(?:new\s+)?(?:album|record|single|project)\s+(?:at|during)/i,
      /(?:premiered|debuted|estrenó|presentó)\s+(?:new\s+)?(?:songs?|material|music|tracks?|album)/i,
    ],
    contextBefore: 60,
    contextAfter: 60,
  },

  // ── Surprise Guest ──
  {
    type: 'surprise_guest',
    patterns: [
      /surprise\s+(?:guest|appearance|set|performance|visit|aparición)/i,
      /(?:unannounced|secret|surprise|unexpected|inesperada?)\s+(?:set|show|performance|appearance|aparición)/i,
      /(?:made\s+(?:a|an)\s+)?(?:surprise|unannounced|unexpected)\s+(?:appearance|visit|cameo)/i,
      /(?:showed\s+up|appeared)\s+(?:unannounced|unexpectedly|without\s+warning)/i,
    ],
    contextBefore: 60,
    contextAfter: 60,
  },

  // ── Collaboration on stage ──
  {
    type: 'collaboration',
    patterns: [
      /(?:joined|invited)\s+(?:on\s+)?stage\s+(?:by|for|with|during)/i,
      /(?:performed|sang|played)\s+(?:together|a\s+duet|alongside)\s+(?:with|on\s+stage)/i,
      /(?:brought\s+out|invitó\s+a|joined\s+by|acompañado\s+por)\s+([^.]{3,50})\s+(?:on\s+stage|al\s+escenario|during)/i,
      /(?:duet|dúo|collaboration|colaboración)\s+(?:with|con|between|entre)\s+([^.]{3,50})/i,
      /(?:special\s+)?guest\s+(?:appearance|performance)\s+(?:by|from|de)\s+([^.]{3,50})/i,
    ],
    contextBefore: 60,
    contextAfter: 60,
  },


  // ── Tribute ──
  {
    type: 'tribute',
    patterns: [
      /(?:tribute|homenaje|tributo|homage)\s+(?:to|a|for|para)\s+([^.]{3,60})/i,
      /(?:in\s+(?:memory|honor|honour)|en\s+(?:memoria|honor))\s+(?:of|de)\s+([^.]{3,60})/i,
      /(?:dedicated|dedicó|dedicada)\s+(?:the\s+)?(?:performance|show|set|song|concert)\s+(?:to|a)\s+([^.]{3,60})/i,
      /(?:moment\s+of\s+silence|minuto\s+de\s+silencio)\s+(?:for|por|para)\s+([^.]{3,60})/i,
    ],
    contextBefore: 40,
    contextAfter: 60,
  },

  // ── Iconic Set / Legendary Performance ──
  {
    type: 'iconic_set',
    patterns: [
      /(?:legendary|iconic|historic|historical|memorable|unforgettable|históric[oa]|legendari[oa]|memorable|inolvidable)\s+(?:performance|set|show|concert|gig|presentación|concierto)/i,
      /(?:widely\s+(?:regarded|considered|seen)|(?:is\s+)?considered)\s+(?:as\s+)?(?:one\s+of\s+)?(?:the\s+)?(?:greatest|best|most\s+important|finest)\s+(?:live\s+)?(?:performances?|sets?|shows?|concerts?)/i,
      /(?:career[- ]defining|era[- ]defining|generation[- ]defining)\s+(?:performance|set|moment|show)/i,
      /(?:defined|cemented|solidified|established)\s+(?:their|his|her)\s+(?:status|place|legacy|reputation)/i,
      /(?:live\s+(?:album|recording|video|DVD|film))\s+(?:was\s+)?(?:recorded|filmed|captured)\s+(?:at|during|from)/i,
    ],
    contextBefore: 60,
    contextAfter: 60,
  },


  // ── Notable Moment (generic but interesting) ──
  {
    type: 'notable_moment',
    patterns: [
      /(?:proposed|got\s+engaged|married|pidió\s+matrimonio)\s+(?:on\s+)?stage/i,
      /(?:crowd[- ]?surf|stage[- ]?div|mosh\s+pit)\s+(?:that|which|causing)/i,
      /(?:broke|smashed|destroyed|rompió)\s+(?:their|his|her|a|the)\s+(?:guitar|instrument|drum)/i,
      /(?:power\s+(?:outage|cut|failure)|blackout|apagón)\s+(?:during|at|en)/i,
      /(?:sound\s+(?:issues?|problems?|failure)|technical\s+(?:difficulties|problems))/i,
      /(?:played|performed)\s+(?:for|during)\s+(?:over|more\s+than|más\s+de)\s+(\d+)\s+(?:hours?|horas?)/i,
      /(?:entire|whole|todo\s+el)\s+(?:crowd|audience|público)\s+(?:sang|chanted|shouted|cantó)/i,
    ],
    contextBefore: 40,
    contextAfter: 60,
  },
];

// ─── Main Extractor ─────────────────────────────────────────

// Artist-centric insight types — we try to extract the artist name for these
const ARTIST_INSIGHT_TYPES = new Set<InsightType>([
  'last_performance', 'comeback', 'debut', 'surprise_guest', 'collaboration',
  'tribute', 'iconic_set',
]);

/**
 * Try to extract an artist name from the text surrounding an insight match.
 * Looks for linked names (from Wikipedia HTML) near the match, or capitalized
 * multi-word names that look like artist/band names.
 */
function extractArtistFromContext(
  $: cheerio.CheerioAPI,
  fullProse: string,
  matchIdx: number,
  matchLen: number,
  linkedNames: string[]
): string | undefined {
  // Strategy 1: find the nearest linked name (Wikipedia <a> tags = known entities)
  // Look in a window of ~120 chars before the match
  const windowStart = Math.max(0, matchIdx - 120);
  const windowEnd = Math.min(fullProse.length, matchIdx + matchLen + 80);
  const window = fullProse.substring(windowStart, windowEnd);

  for (const name of linkedNames) {
    if (name.length >= 3 && window.includes(name)) {
      return name;
    }
  }

  // Strategy 2: look for capitalized multi-word patterns near the match (band names)
  // e.g., "Led Zeppelin performed their last...", "Bad Bunny made a surprise..."
  const beforeText = fullProse.substring(Math.max(0, matchIdx - 80), matchIdx);
  const nameMatch = beforeText.match(/([A-Z][a-zÀ-ÿ]+(?:\s+(?:and\s+(?:the\s+)?|the\s+|of\s+|de\s+|&\s+)?[A-Z][a-zÀ-ÿ]+){0,4})\s*(?:['']s\s+)?$/);
  if (nameMatch && nameMatch[1].length >= 3 && nameMatch[1].length <= 50) {
    // Filter out common false positives (sentence starters, generic words)
    const fp = /^(?:The\s+(?:festival|event|edition|year|band|group|crowd)|This|That|After|Before|During|However|Although|Since|While)\b/i;
    if (!fp.test(nameMatch[1])) {
      return nameMatch[1];
    }
  }

  return undefined;
}

/**
 * Extract insights from section HTML text.
 * @param html - Raw Wikipedia section HTML
 * @param year - Year context (from section title or parser)
 * @param edition - Edition context (from section title)
 * @returns Array of extracted insights
 */
export function extractInsights(
  html: string,
  year?: number,
  edition?: string
): FestivalInsight[] {
  const $ = cheerio.load(html);
  const insights: FestivalInsight[] = [];
  const seen = new Set<string>(); // dedup key: type + first 50 chars

  // Extract plain text from prose paragraphs (not tables, not lists)
  const proseTexts: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().replace(/\[(?:\d+|citation needed|verify|clarification needed)\]/gi, '').replace(/\s+/g, ' ').trim();
    if (text.length > 20) proseTexts.push(text);
  });
  const fullProse = proseTexts.join(' ');

  // Collect all linked names from <a> tags in prose — these are known entities (artists, venues, etc.)
  const linkedNames: string[] = [];
  $('p a').each((_, el) => {
    const name = $(el).text().trim();
    // Filter to likely artist names: 2+ chars, starts with uppercase, not a year/date
    if (name.length >= 2 && /^[A-ZÀ-Ÿ]/.test(name) && !/^\d{4}$/.test(name) && name.length <= 60) {
      linkedNames.push(name);
    }
  });

  // Also check table captions and headers for venue/stage data
  const tableTexts: string[] = [];
  $('caption, th').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 3) tableTexts.push(text);
  });

  for (const patternDef of INSIGHT_PATTERNS) {
    // Allow multiple matches for artist-centric types (different artists can have different insights)
    const maxMatches = ARTIST_INSIGHT_TYPES.has(patternDef.type) ? 5 : 1;
    let matchCount = 0;
    let searchFrom = 0;

    for (const regex of patternDef.patterns) {
      if (matchCount >= maxMatches) break;

      // Use global search for artist-centric patterns
      const globalRegex = ARTIST_INSIGHT_TYPES.has(patternDef.type)
        ? new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')
        : regex;

      let match: RegExpMatchArray | null;
      if (ARTIST_INSIGHT_TYPES.has(patternDef.type)) {
        // Find all matches
        const allMatches: RegExpExecArray[] = [];
        let m: RegExpExecArray | null;
        while ((m = (globalRegex as RegExp).exec(fullProse)) !== null) {
          allMatches.push(m);
          if (allMatches.length >= maxMatches) break;
        }
        for (const am of allMatches) {
          if (matchCount >= maxMatches) break;
          const matchIdx = am.index ?? 0;
          const before = patternDef.contextBefore ?? 0;
          const after = patternDef.contextAfter ?? 0;
          const start = Math.max(0, matchIdx - before);
          const end = Math.min(fullProse.length, matchIdx + am[0].length + after);

          let text: string;
          if (patternDef.transform) {
            const transformed = patternDef.transform(am, fullProse.substring(start, end));
            if (!transformed) continue;
            text = transformed;
          } else {
            text = fullProse.substring(start, end).replace(/\s+/g, ' ').trim();
          }

          text = text.replace(/\s+\S*$/, '').trim();
          if (text.length < 10) continue;

          const dedupKey = `${patternDef.type}:${text.substring(0, 50)}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          // Try to extract artist name for artist-centric insights
          const artistName = extractArtistFromContext($, fullProse, matchIdx, am[0].length, linkedNames);

          insights.push({
            year,
            edition,
            type: patternDef.type,
            text,
            artistName,
            source: 'prose',
          });
          matchCount++;
        }
      } else {
        // Single match for festival-level patterns
        match = fullProse.match(regex);
        if (match) {
          const matchIdx = match.index ?? 0;
          const before = patternDef.contextBefore ?? 0;
          const after = patternDef.contextAfter ?? 0;
          const start = Math.max(0, matchIdx - before);
          const end = Math.min(fullProse.length, matchIdx + match[0].length + after);

          let text: string;
          if (patternDef.transform) {
            const transformed = patternDef.transform(match, fullProse.substring(start, end));
            if (!transformed) continue;
            text = transformed;
          } else {
            text = fullProse.substring(start, end).replace(/\s+/g, ' ').trim();
          }

          text = text.replace(/\s+\S*$/, '').trim();
          if (text.length < 10) continue;

          const dedupKey = `${patternDef.type}:${text.substring(0, 50)}`;
          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          insights.push({
            year,
            edition,
            type: patternDef.type,
            text,
            source: 'prose',
          });
          matchCount++;
          break;
        }
      }
    }
  }

  return insights;
}

// ─── Date Extraction ────────────────────────────────────────

const MONTHS_EN: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
};
const MONTHS_ES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};
const MONTHS_PT: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08',
  setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};
const ALL_MONTHS = { ...MONTHS_EN, ...MONTHS_ES, ...MONTHS_PT };
const MONTH_NAMES = Object.keys(ALL_MONTHS).join('|');

/**
 * Extract precise date(s) from HTML prose for a given year.
 * Returns { date: 'YYYY-MM-DD', dateEnd?: 'YYYY-MM-DD' } or null.
 * Looks for patterns like "June 14–16, 2024" or "14–16 de junio de 2024".
 */
export function extractDate(html: string, year: number): { date: string; dateEnd?: string } | null {
  const $ = cheerio.load(html);
  const texts: string[] = [];
  $('p').not('.mw-empty-elt').each((_, el) => {
    const t = $(el).text().replace(/\[(?:\d+|citation needed)\]/gi, '').replace(/\s+/g, ' ').trim();
    if (t.length > 10) texts.push(t);
  });
  const text = texts.join(' ');

  // Pattern 1: "Month DD–DD, YYYY" or "Month DD-DD YYYY"
  const p1 = new RegExp(`(${MONTH_NAMES})\\s+(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})(?:\\s*,?\\s*|\\s+)(${year})`, 'i');
  const m1 = text.match(p1);
  if (m1) {
    const month = ALL_MONTHS[m1[1].toLowerCase()];
    if (month) {
      const d1 = m1[2].padStart(2, '0');
      const d2 = m1[3].padStart(2, '0');
      return { date: `${year}-${month}-${d1}`, dateEnd: `${year}-${month}-${d2}` };
    }
  }

  // Pattern 2: "DD–DD Month YYYY" or "DD–DD de month de YYYY"
  const p2 = new RegExp(`(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})\\s+(?:de\\s+)?(${MONTH_NAMES})\\s+(?:de\\s+)?(${year})`, 'i');
  const m2 = text.match(p2);
  if (m2) {
    const month = ALL_MONTHS[m2[3].toLowerCase()];
    if (month) {
      const d1 = m2[1].padStart(2, '0');
      const d2 = m2[2].padStart(2, '0');
      return { date: `${year}-${month}-${d1}`, dateEnd: `${year}-${month}-${d2}` };
    }
  }

  // Pattern 3: "Month DD, YYYY" (single date, no range)
  const p3 = new RegExp(`(${MONTH_NAMES})\\s+(\\d{1,2})(?:\\s*,?\\s*|\\s+)(${year})`, 'i');
  const m3 = text.match(p3);
  if (m3) {
    const month = ALL_MONTHS[m3[1].toLowerCase()];
    if (month) {
      const d1 = m3[2].padStart(2, '0');
      return { date: `${year}-${month}-${d1}` };
    }
  }

  // Pattern 4: "DD de month de YYYY" (single date, Spanish/Portuguese)
  const p4 = new RegExp(`(\\d{1,2})\\s+de\\s+(${MONTH_NAMES})\\s+de\\s+(${year})`, 'i');
  const m4 = text.match(p4);
  if (m4) {
    const month = ALL_MONTHS[m4[2].toLowerCase()];
    if (month) {
      const d1 = m4[1].padStart(2, '0');
      return { date: `${year}-${month}-${d1}` };
    }
  }

  // Pattern 5: "Month YYYY" (month only, no day — at least better than Jan 1)
  const p5 = new RegExp(`(?:held|takes?\\s+place|scheduled|\\bin)\\s+(?:(?:in|during|for)\\s+)?(${MONTH_NAMES})\\s+(?:of\\s+)?(${year})`, 'i');
  const m5 = text.match(p5);
  if (m5) {
    const month = ALL_MONTHS[m5[1].toLowerCase()];
    if (month) {
      return { date: `${year}-${month}-01` };
    }
  }

  // Pattern 6: "el DD de month" / "los días DD y DD de month" — Spanish/Portuguese without year
  // Common in per-year section prose where the year is implied by the section heading
  const p6a = /(?:los\s+días?\s+|el\s+día\s+|el\s+)(\d{1,2})\s*(?:y|–|—|-)\s*(\d{1,2})\s+de\s+(MONTHS)/i.source.replace('MONTHS', MONTH_NAMES);
  const m6a = text.match(new RegExp(p6a, 'i'));
  if (m6a) {
    const month = ALL_MONTHS[m6a[3].toLowerCase()];
    if (month) {
      return { date: `${year}-${month}-${m6a[1].padStart(2, '0')}`, dateEnd: `${year}-${month}-${m6a[2].padStart(2, '0')}` };
    }
  }

  const p6b = /(?:el\s+día\s+|el\s+|celebr[oó]\s+el\s+)(\d{1,2})\s+de\s+(MONTHS)/i.source.replace('MONTHS', MONTH_NAMES);
  const m6b = text.match(new RegExp(p6b, 'i'));
  if (m6b) {
    const month = ALL_MONTHS[m6b[2].toLowerCase()];
    if (month) {
      return { date: `${year}-${month}-${m6b[1].padStart(2, '0')}` };
    }
  }

  // Pattern 7: "on the Nth/DD of Month" — English without year
  const p7 = /(?:held\s+on|took\s+place\s+on|on\s+the\s+)(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(MONTHS)/i.source.replace('MONTHS', MONTH_NAMES);
  const m7 = text.match(new RegExp(p7, 'i'));
  if (m7) {
    const month = ALL_MONTHS[m7[2].toLowerCase()];
    if (month) {
      return { date: `${year}-${month}-${m7[1].padStart(2, '0')}` };
    }
  }

  return null;
}

/**
 * Extract insights from the intro/lead section of a festival page.
 * This often has summary stats like total attendance, founding year, etc.
 */
export function extractIntroInsights(
  html: string,
  festivalTitle: string
): FestivalInsight[] {
  return extractInsights(html);
}

// ─── Location Extractor ────────────────────────────────────

export interface FestivalLocation {
  city?: string;
  country?: string;
  raw: string; // The matched text for debugging
}

/**
 * Extract city/country from Wikipedia intro HTML.
 * Wikipedia festival intros typically say:
 *   "...is a music festival held in {City}, {Country}"
 *   "...takes place in {City}, {State/Country}"
 *   "...que se celebra en {City}, {Country}"
 */
export function extractLocation(html: string): FestivalLocation | null {
  const $ = cheerio.load(html);
  // Try the first 3 real paragraphs (skip mw-empty-elt)
  const paragraphs = $('p').not('.mw-empty-elt').slice(0, 3);
  const texts: string[] = [];
  paragraphs.each((_, el) => {
    const t = $(el).text()
      .replace(/\[(?:\d+|citation needed|verify|clarification needed)\]/gi, '')
      .replace(/\.mw-parser-output[^.]+/g, '') // Strip CSS noise
      .replace(/\s+/g, ' ').trim();
    if (t.length >= 20) texts.push(t);
  });

  // Combine first 3 paragraphs for scanning
  const text = texts.join(' ');
  if (!text || text.length < 20) return null;

  // Patterns to find location — ordered by specificity
  // These capture "in City, State/Country" allowing intermediate words like "in Grant Park in Chicago"
  const patterns: RegExp[] = [
    // "held/takes place in ... City, State/Country" — flexible gap between verb and preposition
    // {0,8} allows for "held yearly since 1990 on the first weekend of August in ..."
    /(?:held|takes?\s+place|located|based)\s+(?:[\w,]+\s+){0,10}?(?:in|at|near|south of|north of|east of|west of|outside)\s+(?:(?:the\s+)?(?:village|town|city|municipality|commune|park|area|region|province|district|department|county)\s+(?:of|in)\s+)?(?:[\w\sÀ-ÿ-]+\s+(?:in|at|near)\s+)?([A-Z][A-Za-zÀ-ÿ\s-]+(?:,\s*[A-Z][A-Za-zÀ-ÿ\s-]+){1,2})/,
    // Same but single city (no comma)
    /(?:held|takes?\s+place|located|based)\s+(?:[\w,]+\s+){0,10}?(?:in|at|near|south of|north of|east of|west of|outside)\s+(?:(?:the\s+)?(?:village|town|city|municipality|commune|park|area|region|province|district|department|county)\s+(?:of|in)\s+)?(?:[\w\sÀ-ÿ-]+\s+(?:in|at|near)\s+)?([A-Z][A-Za-zÀ-ÿ]{2,}(?:\s[A-Za-zÀ-ÿ]+){0,3})/,
    // "located in/near City, Region" (standalone — for second-sentence locations)
    /(?:is\s+)?located\s+(?:in|at|near)\s+([A-Z][A-Za-zÀ-ÿ\s-]+(?:,\s*[A-Z][A-Za-zÀ-ÿ\s-]+){0,2})/,
    // "in City, Country since/from/every/annually"
    /\bin\s+([A-Z][A-Za-zÀ-ÿ\s-]+,\s*[A-Z][A-Za-zÀ-ÿ\s-]+)(?:\s*(?:since|from|every|annually|each|during))/,
    // "festival in/at City, Country"
    /festival\s+(?:in|at|near)\s+(?:[\w\s-]+\s+(?:in|at|near)\s+)?([A-Z][A-Za-zÀ-ÿ\s-]+(?:,\s*[A-Z][A-Za-zÀ-ÿ\s-]+){0,2})/i,
    // Spanish: "se celebra/realiza/lleva a cabo en Ciudad, País"
    /(?:se\s+)?(?:celebra|realiza|lleva\s+a\s+cabo|tiene\s+lugar|desarrolla)\s+en\s+([A-Z][A-Za-zÀ-ÿ\s-]+(?:,\s*[A-Z][A-Za-zÀ-ÿ\s-]+){0,2})/,
    // Portuguese: "realizado em Cidade, País"
    /(?:realizado|ocorre|acontece)\s+em\s+([A-Z][A-Za-zÀ-ÿ\s-]+(?:,\s*[A-Z][A-Za-zÀ-ÿ\s-]+){0,2})/,
    // German: "findet in Stadt, Land statt"
    /(?:findet|fand)\s+(?:in|bei|nahe)\s+([A-Z][A-Za-zÀ-ÿ\s-]+(?:,\s*[A-Z][A-Za-zÀ-ÿ\s-]+){0,2})\s+statt/,
    // French: "se déroule/tient à Ville, Pays"
    /(?:se\s+)?(?:déroule|tient)\s+à\s+([A-Z][A-Za-zÀ-ÿ\s-]+(?:,\s*[A-Z][A-Za-zÀ-ÿ\s-]+){0,2})/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const raw = match[1].trim().replace(/\s+/g, ' ');
      // Clean: remove trailing periods, "the", numbers, noise words
      let cleaned = raw.replace(/\.$/, '').replace(/\bthe\s+/gi, '').trim();
      // Trim noise at the end: "California It originally" → "California"
      cleaned = cleaned.replace(/\s+(?:It|The|This|Since|From|Originally|He|She|They|And|Which|Where|During|After|Before)\b.*$/i, '').trim();
      if (cleaned.length < 3 || cleaned.length > 80) continue;

      // Skip if result starts with a month name or contains date-like words (false positives from date phrases)
      if (/^(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(cleaned)) continue;
      if (/\b(?:each year|every year|annually|weekend|week)\b/i.test(cleaned)) continue;

      // Split into city, country (if comma-separated)
      const parts = cleaned.split(/,\s*/);
      // Filter out parts that look like noise (all lowercase, very short single letters, etc)
      const goodParts = parts.filter(p => p.length >= 2 && /^[A-Z]/.test(p));
      if (goodParts.length === 0) continue;

      if (goodParts.length >= 2) {
        return normalizeLocation({
          city: goodParts[0].trim(),
          country: goodParts[goodParts.length - 1].trim(),
          raw: cleaned,
        });
      }
      return normalizeLocation({ city: goodParts[0].trim(), raw: cleaned });
    }
  }

  // Venue-name patterns — only accept if result is a known city
  // "Universidad/Campus/Estadio X de Madrid" → "Madrid"
  const venuePatterns: RegExp[] = [
    /(?:Universidad|Campus|Estadio|Recinto|Complejo|Parque|Hipódromo|Velódromo|Auditorio|Palacio)\s+(?:[\w\sÀ-ÿ]+\s+)?de\s+([A-Z][A-Za-zÀ-ÿ]{2,}(?:\s[A-Za-zÀ-ÿ]+){0,2})(?:[.,\s]|$)/,
    /(?:University|Stadium|Arena|Park|Fairground|Racecourse|Hippodrome)\s+(?:of|in)\s+([A-Z][A-Za-zÀ-ÿ]{2,}(?:\s[A-Za-zÀ-ÿ]+){0,2})(?:[.,\s]|$)/,
  ];
  for (const vp of venuePatterns) {
    const vm = text.match(vp);
    if (vm && vm[1]) {
      const candidate = vm[1].trim();
      const known = CITY_MAP[candidate.toLowerCase()];
      if (known) return { city: known.city, country: known.country, raw: candidate };
    }
  }

  // Final fallback: scan full text for any known city name
  // Handles "Universidad Complutense de Madrid", "Recinto Ferial de Zaragoza", etc.
  const lowerText = text.toLowerCase();
  // Sort by length descending so "buenos aires" matches before "aires"
  const sortedCities = Object.entries(CITY_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [key, cityInfo] of sortedCities) {
    if (key.length < 4) continue; // skip ambiguous short keys like "ba", "rio"
    if (lowerText.includes(key)) {
      return { city: cityInfo.city, country: cityInfo.country, raw: key };
    }
  }

  return null;
}

/**
 * Extract location from the festival title as a fallback.
 * Handles patterns like "Lollapalooza Chile", "Creamfields BA", "Ultra Japan".
 */

const COUNTRY_MAP: Record<string, string> = {
  // English
  'argentina': 'Argentina', 'chile': 'Chile', 'brasil': 'Brazil', 'brazil': 'Brazil',
  'perú': 'Peru', 'peru': 'Peru', 'colombia': 'Colombia', 'méxico': 'Mexico', 'mexico': 'Mexico',
  'japan': 'Japan', 'germany': 'Germany', 'france': 'France', 'spain': 'Spain',
  'españa': 'Spain', 'uk': 'United Kingdom', 'australia': 'Australia',
  'south africa': 'South Africa', 'india': 'India', 'korea': 'South Korea',
  'portugal': 'Portugal', 'italia': 'Italy', 'italy': 'Italy', 'suecia': 'Sweden',
  'sweden': 'Sweden', 'norway': 'Norway', 'finland': 'Finland', 'denmark': 'Denmark',
  'netherlands': 'Netherlands', 'belgium': 'Belgium', 'austria': 'Austria',
  'switzerland': 'Switzerland', 'ireland': 'Ireland', 'canada': 'Canada',
  'new zealand': 'New Zealand', 'indonesia': 'Indonesia', 'thailand': 'Thailand',
  'malaysia': 'Malaysia', 'singapore': 'Singapore', 'taiwan': 'Taiwan',
  'costa rica': 'Costa Rica', 'ecuador': 'Ecuador', 'bolivia': 'Bolivia',
  'paraguay': 'Paraguay', 'uruguay': 'Uruguay', 'venezuela': 'Venezuela',
  'panamá': 'Panama', 'panama': 'Panama', 'guatemala': 'Guatemala',
  'república dominicana': 'Dominican Republic', 'dominicana': 'Dominican Republic',
  'usa': 'United States', 'united states': 'United States',
  'croatia': 'Croatia', 'serbia': 'Serbia', 'hungary': 'Hungary', 'romania': 'Romania',
  'czech republic': 'Czech Republic', 'poland': 'Poland', 'greece': 'Greece',
  'turkey': 'Turkey', 'israel': 'Israel', 'morocco': 'Morocco', 'egypt': 'Egypt',
};

const CITY_MAP: Record<string, { city: string; country: string }> = {
  'buenos aires': { city: 'Buenos Aires', country: 'Argentina' },
  'ba': { city: 'Buenos Aires', country: 'Argentina' },
  'são paulo': { city: 'São Paulo', country: 'Brazil' },
  'sao paulo': { city: 'São Paulo', country: 'Brazil' },
  'santiago': { city: 'Santiago', country: 'Chile' },
  'bogotá': { city: 'Bogotá', country: 'Colombia' },
  'bogota': { city: 'Bogotá', country: 'Colombia' },
  'lima': { city: 'Lima', country: 'Peru' },
  'tokyo': { city: 'Tokyo', country: 'Japan' },
  'berlin': { city: 'Berlin', country: 'Germany' },
  'paris': { city: 'Paris', country: 'France' },
  'madrid': { city: 'Madrid', country: 'Spain' },
  'barcelona': { city: 'Barcelona', country: 'Spain' },
  'lisboa': { city: 'Lisbon', country: 'Portugal' },
  'lisbon': { city: 'Lisbon', country: 'Portugal' },
  'melbourne': { city: 'Melbourne', country: 'Australia' },
  'sydney': { city: 'Sydney', country: 'Australia' },
  'london': { city: 'London', country: 'United Kingdom' },
  'amsterdam': { city: 'Amsterdam', country: 'Netherlands' },
  'monterrey': { city: 'Monterrey', country: 'Mexico' },
  'guadalajara': { city: 'Guadalajara', country: 'Mexico' },
  'medellín': { city: 'Medellín', country: 'Colombia' },
  'medellin': { city: 'Medellín', country: 'Colombia' },
  'seoul': { city: 'Seoul', country: 'South Korea' },
  'andalucía': { city: 'Andalucía', country: 'Spain' },
  'andalucia': { city: 'Andalucía', country: 'Spain' },
  // Major cities for multi-city festival editions
  'rio de janeiro': { city: 'Rio de Janeiro', country: 'Brazil' },
  'rio': { city: 'Rio de Janeiro', country: 'Brazil' },
  'las vegas': { city: 'Las Vegas', country: 'United States' },
  'chicago': { city: 'Chicago', country: 'United States' },
  'new york': { city: 'New York', country: 'United States' },
  'los angeles': { city: 'Los Angeles', country: 'United States' },
  'san francisco': { city: 'San Francisco', country: 'United States' },
  'miami': { city: 'Miami', country: 'United States' },
  'detroit': { city: 'Detroit', country: 'United States' },
  'atlanta': { city: 'Atlanta', country: 'United States' },
  'manchester': { city: 'Manchester', country: 'United Kingdom' },
  'glasgow': { city: 'Glasgow', country: 'United Kingdom' },
  'dublin': { city: 'Dublin', country: 'Ireland' },
  'osaka': { city: 'Osaka', country: 'Japan' },
  'cape town': { city: 'Cape Town', country: 'South Africa' },
  'johannesburg': { city: 'Johannesburg', country: 'South Africa' },
  'mumbai': { city: 'Mumbai', country: 'India' },
  'bangkok': { city: 'Bangkok', country: 'Thailand' },
  'toronto': { city: 'Toronto', country: 'Canada' },
  'montreal': { city: 'Montreal', country: 'Canada' },
  'stockholm': { city: 'Stockholm', country: 'Sweden' },
  'copenhagen': { city: 'Copenhagen', country: 'Denmark' },
  'helsinki': { city: 'Helsinki', country: 'Finland' },
  'brussels': { city: 'Brussels', country: 'Belgium' },
  'vienna': { city: 'Vienna', country: 'Austria' },
  'zurich': { city: 'Zurich', country: 'Switzerland' },
  'prague': { city: 'Prague', country: 'Czech Republic' },
  'budapest': { city: 'Budapest', country: 'Hungary' },
  'warsaw': { city: 'Warsaw', country: 'Poland' },
  'donington': { city: 'Donington Park', country: 'United Kingdom' },
  'nuremberg': { city: 'Nuremberg', country: 'Germany' },
  'nürburgring': { city: 'Nürburgring', country: 'Germany' },
  'wacken': { city: 'Wacken', country: 'Germany' },
};

/**
 * Normalize a FestivalLocation: if city is known but country is missing (or vice versa),
 * resolve the missing field using CITY_MAP / COUNTRY_MAP.
 */
// US states and other subnational regions that Wikipedia uses as "country" in "City, State" patterns
const STATE_TO_COUNTRY: Record<string, string> = {
  'california': 'United States', 'new york': 'United States', 'texas': 'United States',
  'florida': 'United States', 'illinois': 'United States', 'nevada': 'United States',
  'tennessee': 'United States', 'michigan': 'United States', 'georgia': 'United States',
  'washington': 'United States', 'oregon': 'United States', 'colorado': 'United States',
  'ohio': 'United States', 'pennsylvania': 'United States', 'wisconsin': 'United States',
  'minnesota': 'United States', 'iowa': 'United States', 'louisiana': 'United States',
  'massachusetts': 'United States', 'maryland': 'United States', 'virginia': 'United States',
  'north carolina': 'United States', 'arizona': 'United States', 'indiana': 'United States',
  'new jersey': 'United States', 'connecticut': 'United States',
  'england': 'United Kingdom', 'scotland': 'United Kingdom', 'wales': 'United Kingdom',
  'northern ireland': 'United Kingdom',
  'ontario': 'Canada', 'quebec': 'Canada', 'british columbia': 'Canada', 'alberta': 'Canada',
  'new south wales': 'Australia', 'victoria': 'Australia', 'queensland': 'Australia',
  'bavaria': 'Germany', 'north rhine-westphalia': 'Germany', 'lower saxony': 'Germany',
  'schleswig-holstein': 'Germany',
  'flanders': 'Belgium', 'wallonia': 'Belgium',
  'catalonia': 'Spain', 'andalusia': 'Spain',
};

export function normalizeLocation(loc: FestivalLocation): FestivalLocation {
  // City known, country missing → look up city in CITY_MAP
  if (loc.city && !loc.country) {
    const key = loc.city.toLowerCase();
    const match = CITY_MAP[key];
    if (match) {
      return { city: match.city, country: match.country, raw: loc.raw };
    }
    // Try partial match
    for (const [k, v] of Object.entries(CITY_MAP)) {
      if (key.includes(k) || k.includes(key)) {
        return { city: v.city, country: v.country, raw: loc.raw };
      }
    }
  }

  // "Country" is actually a state/region → resolve to real country
  if (loc.country) {
    const stateKey = loc.country.toLowerCase();
    const realCountry = STATE_TO_COUNTRY[stateKey];
    if (realCountry) {
      return { city: loc.city, country: realCountry, raw: loc.raw };
    }
  }

  return loc;
}

export function extractLocationFromTitle(title: string): FestivalLocation | null {
  const lower = title.toLowerCase().trim();

  // Check city names first (more specific)
  for (const [key, loc] of Object.entries(CITY_MAP)) {
    if (lower.includes(key)) {
      return { city: loc.city, country: loc.country, raw: `${loc.city}, ${loc.country}` };
    }
  }

  // Check country names
  for (const [key, country] of Object.entries(COUNTRY_MAP)) {
    // Match as whole word — use space/start/end/paren boundaries since \b doesn't work with Unicode
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s(])${escaped}(?:$|[\\s)])`, 'i');
    if (regex.test(lower)) {
      return { country, raw: country };
    }
  }

  return null;
}
