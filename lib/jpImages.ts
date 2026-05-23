/**
 * Shared JP card image resolution.
 *
 * PPT API returns Japanese card data with names like "Sightseer - 192/173"
 * but its `image` field points at tcgplayer-cdn.tcgplayer.com — which 403s
 * when hot-linked from React Native. So for JP cards we resolve a hi-res
 * image via:
 *
 *   1. artofpkm (cached in our `artofpkm_card_images` Supabase table,
 *      keyed by `<set-slug>/<padded-localId>`)
 *   2. TCGdex JA  (`https://api.tcgdex.net/v2/ja/cards?localId=<n>`),
 *      matched back to the right set by the total-card-count fingerprint
 *      that PPT puts after the slash (e.g. "/173" = set has 173 cards).
 *
 * Used by:
 *   - app/(tabs)/search.tsx        (enrich live search/hot results)
 *   - app/(tabs)/portfolio.tsx     (rescue images for already-added cards
 *                                   that were saved with empty image_url
 *                                   because the live enrichment failed)
 *   - app/(tabs)/index.tsx         (home-page hot cards)
 */
import { supabase } from './supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * PPT JP card names follow the shape `"<card name> - <localId>/<setHint>"`,
 * where setHint is either the set's total card count (e.g. "173") or a set
 * code (e.g. "SV-P"). This pulls the two trailing fields out.
 */
export function parsePPTRef(name: string): { localId: string; setCode: string } | null {
  const m = name.match(/[-–]\s*0*(\d+)\s*\/\s*([A-Za-z0-9-]+)\s*$/);
  if (!m) return null;
  return { localId: m[1], setCode: m[2].toUpperCase() };
}

const PROMO_SET_CODES = new Set(['XY-P', 'SM-P', 'SV-P', 'M-P', 'S-P', 'BW-P', 'L-P']);

function slugifySetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['`]/g, '')
    .replace(/[‘’“”]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function stripSetSeriesCode(name: string): string {
  return name.replace(/^[A-Z]{1,4}\d*[a-z]?:\s*/i, '').trim();
}

// PPT delivers set names with plain ASCII "Pokemon", but artofpkm scrapes the
// site's HTML which uses "Pokémon" (with é). The é becomes a hyphen during
// slugify, so artofpkm's DB ends up with `pok-mon-…` while our app generates
// `pokemon-…`. We bridge that gap two ways:
//   1. Explicit aliases for sets we've seen miss in production
//   2. An automatic `pokemon` → `pok-mon` rewrite in every slug variant
const SET_SLUG_ALIASES: Record<string, string> = {
  'pokemon-vs':          'pok-mon-card-vs',
  'pokemon-card-game':   'pok-mon-card-game',
  'pokemon-go':          'pok-mon-go',
  'pokemon-151':         'pok-mon-card-151',
  'pokemon-card-151':    'pok-mon-card-151',
};

/**
 * Authoritative map from official set code (extracted from the PPT setName
 * prefix, e.g. "SM12a: …" → "sm12a") to the canonical artofpkm slug.
 *
 * This bypasses all the slugify gymnastics PPT forces on us — PPT names like
 * "SM12a: TAG TEAM GX: Tag All Stars" can't be slugified to anything that
 * matches artofpkm's "tag-team-gx-all-stars" without explicit knowledge.
 *
 * Expand this as new sets land. The key MUST be lowercase; the value MUST
 * match what `scripts/scrape-artofpkm.mjs` produces for that set.
 */
const SET_CODE_TO_ARTOFPKM_SLUG: Record<string, string> = {
  // ── Scarlet & Violet (JP) ─────────────────────────────────────────────
  'sv1a': 'triplet-beat',
  'sv1s': 'scarlet-ex',
  'sv1v': 'violet-ex',
  'sv2a': 'pok-mon-card-151',
  'sv2d': 'clay-burst',
  'sv2p': 'snow-hazard',
  'sv3':  'ruler-of-the-black-flame',
  'sv3a': 'raging-surf',
  'sv4a': 'shiny-treasure-ex',
  'sv4k': 'ancient-roar',
  'sv4m': 'future-flash',
  'sv5a': 'crimson-haze',
  'sv5k': 'wild-force',
  'sv5m': 'cyber-judge',
  'sv6':  'mask-of-change',
  'sv6a': 'night-wanderer',
  'sv7':  'stellar-miracle',
  'sv7a': 'paradise-dragona',
  'sv8':  'super-electric-breaker',
  'sv8a': 'terastal-fest-ex',
  'sv9':  'battle-partners',
  'sv10': 'rocket-gang',
  // ── Sword & Shield (JP) ───────────────────────────────────────────────
  's1a':  'vmax-rising',
  's1h':  'shield',
  's1w':  'sword',
  's2':   'rebellious-clash',
  's2a':  'explosive-walker',
  's3':   'infinity-zone',
  's3a':  'legendary-heartbeat',
  's4':   'amazing-volt-tackle',
  's4a':  'shiny-star-v',
  's5a':  'matchless-fighters',
  's5i':  'single-strike-master',
  's5r':  'rapid-strike-master',
  's6a':  'eevee-heroes',
  's6h':  'silver-lance',
  's6k':  'jet-black-poltergeist',
  's7d':  'skyscraping-perfect',
  's7r':  'blue-sky-stream',
  's8':   'fusion-arts',
  's8a':  '25th-anniversary-collection',
  's8b':  'vmax-climax',
  's9':   'star-birth',
  's9a':  'battle-region',
  's10a': 'dark-phantasma',
  's10b': 'pok-mon-go',
  's10d': 'time-gazer',
  's10p': 'space-juggler',
  's11':  'lost-abyss',
  's11a': 'incandescent-arcana',
  's12':  'paradigm-trigger',
  's12a': 'vstar-universe',
  // ── Sun & Moon (JP) ───────────────────────────────────────────────────
  'sm12a': 'tag-team-gx-all-stars',
  'sm12':  'alter-genesis',
  'sm11a': 'remix-bout',
  'sm11b': 'dream-league',
  'sm11':  'miracle-twin',
  'sm10b': 'sky-legend',
  'sm10a': 'sky-legends',
  'sm10':  'double-blaze',
  'sm9a':  'night-unison',
  'sm9b':  'full-metal-wall',
  'sm9':   'tag-bolt',
  'sm8a':  'dark-order',
  'sm8b':  'gx-ultra-shiny',
  'sm8':   'super-burst-impact',
  'sm7a':  'thunderclap-spark',
  'sm7b':  'fairy-rise',
  'sm7':   'sky-guardians',
  // ── Promo sets (used as the setCode itself) ──────────────────────────
  // These don't go through this map; jpImages handles promo codes via
  // PROMO_SET_CODES + `<paddedId>/<setCode>` key instead.
};

/** Build all slug variants we might try for a given PPT set name. */
export function setNameSlugVariants(setName: string): string[] {
  const full     = slugifySetName(setName);
  const stripped = slugifySetName(stripSetSeriesCode(setName));
  // PPT sometimes has TWO prefixes ("SM12a: TAG TEAM GX: ..."), strip one more
  const doubleStripped = slugifySetName(stripSetSeriesCode(stripSetSeriesCode(setName)));

  // Pull the alphanumeric set code prefix (e.g. "sm12a", "sv2a") for the
  // authoritative slug lookup. This avoids relying on PPT's messy set name
  // entirely when we know the code.
  const codeMatch = setName.match(/^([A-Za-z]{1,4}\d*[a-z]?)\b/);
  const canonical = codeMatch ? SET_CODE_TO_ARTOFPKM_SLUG[codeMatch[1].toLowerCase()] : undefined;

  const base = [full, stripped, doubleStripped].filter(Boolean);
  const aliased = base.map(v => SET_SLUG_ALIASES[v] ?? v);
  // Auto "pok-mon" variant: replace the word "pokemon" with "pok-mon" anywhere
  // it appears. This catches new Pokémon sets without us having to add an
  // explicit alias every time.
  const pokmon = base.map(v => v.replace(/pokemon/g, 'pok-mon'));
  // Canonical comes FIRST so we try the most reliable lookup before fuzzier ones.
  return [...new Set([...(canonical ? [canonical] : []), ...base, ...aliased, ...pokmon])];
}

/** True if the URL points at a CDN we know works from React Native. */
export function hasReliableImage(url: string): boolean {
  // tcgplayer-cdn.tcgplayer.com is excluded — returns 403 when hotlinked.
  return url.includes('artofpkm.com') ||
         url.includes('tcgdex.net') ||
         url.includes('images.pokemontcg.io');
}

// ─── Module-level caches (one per app session) ────────────────────────────────
// IMPORTANT: these are cleared by clearJpImageCaches() on logout to prevent
// cross-user data leak on shared devices. Otherwise user A's cached images
// would persist after user A logs out and user B logs in.

const artofpkmCache = new Map<string, string>();   // key → image url
const tcgdexCache   = new Map<string, string>();   // localId+setTotal → image url
const nameCache     = new Map<string, string>();   // PPT name → resolved image url

/** Clear all in-memory caches. Call on logout / auth state change. */
export function clearJpImageCaches(): void {
  artofpkmCache.clear();
  tcgdexCache.clear();
  nameCache.clear();
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Given a list of `{ name, setName }` (PPT-shaped), returns a `name → image_url`
 * map for everything we managed to resolve. Names without a hit are simply
 * omitted — caller decides whether to render a placeholder.
 *
 * Implementation:
 *   • Batches the artofpkm Supabase lookup (one query for the whole list)
 *   • Promise.allSettled for TCGdex JA fallbacks (parallel, won't hang on one)
 *   • Caps to 50 unique names per call to keep request sizes sane
 */
export async function fetchHiresJPImages(
  items: Array<{ name: string; setName?: string }>
): Promise<Record<string, string>> {
  if (!items.length) return {};
  const seen = new Set<string>();
  const unique = items
    .filter(i => { if (seen.has(i.name)) return false; seen.add(i.name); return true; })
    .slice(0, 50);

  const map: Record<string, string> = {};
  const needSupabase: { name: string; key: string }[] = [];
  const needTcgdex:   { name: string; setName?: string }[] = [];

  for (const { name, setName } of unique) {
    // Per-name memo
    const cached = nameCache.get(name);
    if (cached) { map[name] = cached; continue; }

    const ref = parsePPTRef(name);

    // Strategy 1: promo sets — single canonical key (paddedId/<set>)
    if (ref && PROMO_SET_CODES.has(ref.setCode)) {
      const key = `${ref.localId.padStart(3, '0')}/${ref.setCode}`;
      if (artofpkmCache.has(key)) {
        map[name] = artofpkmCache.get(key)!;
        nameCache.set(name, map[name]);
      } else {
        needSupabase.push({ name, key });
      }
      continue;
    }

    // Strategy 1.5: popular set cards — try multiple slug variants
    if (ref && setName) {
      const paddedId = ref.localId.padStart(3, '0');
      const variants = setNameSlugVariants(setName);
      const memoKey  = variants.map(s => `${s}/${paddedId}`).find(k => artofpkmCache.has(k));
      if (memoKey) {
        map[name] = artofpkmCache.get(memoKey)!;
        nameCache.set(name, map[name]);
      } else {
        for (const slug of variants) {
          needSupabase.push({ name, key: `${slug}/${paddedId}` });
        }
      }
      continue;
    }

    needTcgdex.push({ name, setName });
  }

  // Promote any still-unresolved names to TCGdex. Used by both the
  // success path and the catch path below so Supabase failures don't
  // strand cards.
  const promoteUnresolvedToTcgdex = () => {
    for (const { name, setName } of unique) {
      if (!map[name] && !needTcgdex.find(n => n.name === name)) {
        needTcgdex.push({ name, setName });
      }
    }
  };

  // ─── Strategy 1: Supabase batch query (artofpkm cached images) ──────────────
  if (needSupabase.length > 0) {
    try {
      const { data } = await supabase
        .from('artofpkm_card_images')
        .select('key, image_url')
        .in('key', needSupabase.map(e => e.key));
      if (data) {
        const dbMap: Record<string, string> = {};
        for (const row of data) dbMap[row.key] = row.image_url;
        for (const { name, key } of needSupabase) {
          if (dbMap[key] && !map[name]) {  // first matching variant wins
            artofpkmCache.set(key, dbMap[key]);
            map[name] = dbMap[key];
            nameCache.set(name, dbMap[key]);
            if (__DEV__) console.log('[artofpkm ✓]', name.slice(0, 35), '→', key);
          }
        }
      }
      promoteUnresolvedToTcgdex();
    } catch (e) {
      if (__DEV__) console.warn('[artofpkm] Supabase query failed:', e);
      promoteUnresolvedToTcgdex();
    }
  }

  // ─── Strategy 2: TCGdex JA — STRICT match only ──────────────────────────────
  // Important: never return "best guess" results. The old code used a ±5
  // card-count tolerance + a "fall back to the first card with this localId"
  // last resort, and ended up showing Riolu (S12a 201/172) for Charizard ex
  // (SV2a 201/165) and Foxslay (S12a 192/172) for Sightseer (SM12a 192/173).
  // We now require BOTH a localId match AND an unambiguous set identification
  // (exact card-count OR exact alphanumeric set-code). Otherwise → no image.
  if (needTcgdex.length > 0) {
    /**
     * Pull the alphanumeric set code from the PPT setName.
     *   "SV2a: Pokemon Card 151"            → "sv2a"
     *   "SM12a: TAG TEAM GX: Tag All Stars" → "sm12a"
     *   "S12a: VSTAR Universe"              → "s12a"
     */
    const extractSetCode = (setName?: string): string | null => {
      if (!setName) return null;
      const m = setName.match(/^([A-Za-z]{1,4}\d*[a-z]?)\b/);
      return m ? m[1].toLowerCase() : null;
    };

    const settled = await Promise.allSettled(
      needTcgdex.map(async ({ name: originalName, setName }) => {
        const ref = parsePPTRef(originalName);
        if (!ref) return null;
        const setTotal     = /^\d+$/.test(ref.setCode) ? parseInt(ref.setCode) : null;
        const wantedCode   = extractSetCode(setName);
        const memoKey      = `${ref.localId}/${setTotal ?? ref.setCode}`;
        const memoHit      = tcgdexCache.get(memoKey);
        if (memoHit) return { name: originalName, image: memoHit };

        // ── (pre) Direct card lookup `/v2/ja/cards/<setCode>-<localId>` ──
        // TCGdex returns the exact card if we can construct its ID. This is
        // the most reliable path — no localId-collision risk across sets.
        if (wantedCode) {
          try {
            const direct = await fetch(
              `https://api.tcgdex.net/v2/ja/cards/${wantedCode}-${ref.localId}`
            ).then(r => r.ok ? r.json() : null);
            if (direct?.image) {
              const url = `${direct.image}/high.webp`;
              tcgdexCache.set(memoKey, url);
              if (__DEV__) console.log('[TCGdex JA ✓ direct]', originalName.slice(0, 35), `${wantedCode}-${ref.localId}`);
              return { name: originalName, image: url };
            }
          } catch {}
        }

        try {
          const jaRes = await fetch(
            `https://api.tcgdex.net/v2/ja/cards?localId=${ref.localId}`
          ).then(r => r.ok ? r.json() : null);
          if (!Array.isArray(jaRes) || jaRes.length === 0) return null;

          let match: any = null;

          // (a) EXACT card-count match — no tolerance. 172 ≠ 173, period.
          if (setTotal) {
            match = jaRes.find((c: any) => {
              const total = c.set?.cardCount?.total ?? c.set?.cardCount?.official ?? 0;
              return total === setTotal;
            });
          }

          // (b) Alphanumeric set-code match (e.g. "sm12a", "sv2a").
          //     This is the strongest signal; trust it over (a).
          if (!match && wantedCode) {
            match = jaRes.find((c: any) => {
              const sid = (c.set?.id ?? c.localSet?.id ?? '').toLowerCase();
              return sid === wantedCode || sid.replace(/-/g, '') === wantedCode.replace(/-/g, '');
            });
          }

          // NO last-resort fallback. If neither (a) nor (b) found a match,
          // we genuinely don't know which set this card is from. Returning
          // the first arbitrary card with this localId would show a wrong
          // image — far worse than a placeholder.
          if (!match || !match.image) {
            if (__DEV__) console.log('[TCGdex JA ✗ no strict match]', originalName.slice(0, 35), `setTotal=${setTotal} wantedCode=${wantedCode}`);
            return null;
          }

          const url = `${match.image}/high.webp`;
          tcgdexCache.set(memoKey, url);
          if (__DEV__) console.log('[TCGdex JA ✓]', originalName.slice(0, 35), `total=${setTotal} code=${wantedCode}`);
          return { name: originalName, image: url };
        } catch {}
        return null;
      })
    );
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) {
        map[r.value.name] = r.value.image;
        nameCache.set(r.value.name, r.value.image);
      }
    }
  }

  if (__DEV__) console.log('[JPImages] resolved:', Object.keys(map).length, '/', unique.length);
  return map;
}
