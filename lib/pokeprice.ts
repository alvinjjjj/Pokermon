/**
 * PokemonPriceTracker (PPT) API service
 * https://www.pokemonpricetracker.com/api/v2
 *
 * Replaces lib/justtcg.ts and lib/cardPrices.ts.
 * Covers EN + JP cards, PSA/CGC/BGS/SGC graded prices, and price history.
 *
 * ─── Credit cost per card ────────────────────────────────────────────────────
 *   1 credit  : base card data (name, set, current price)
 *   +1 credit : includeHistory=true  (price history up to 6 months on API plan)
 *   +1 credit : PSA/eBay graded data (included automatically on paid plan)
 *   = 3 credits per card when requesting full data
 *
 * ─── Cache strategy (credit optimisation) ───────────────────────────────────
 *   Layer 1 — in-memory  : current session, instant, 0 credits
 *   Layer 2 — Supabase   : shared across ALL users (1 DB read instead of API call)
 *                          Hot cards: 6h TTL | Individual cards: 24h TTL
 *   Layer 3 — PPT API    : only on full cache miss
 *
 * ─── Daily credit budget estimate (5,000 users) ─────────────────────────────
 *   Home screen hot 30 JP cards × 3 credits = 90, cached 6h → 360/day
 *   Card detail ~500 unique cache misses × 3 = 1,500/day
 *   Total ≈ 1,860 / 20,000 daily limit  (< 10%)
 */

import { POKEPRICE_BASE_URL, SUPABASE_URL } from '../constants/config';
import { supabase } from './supabase';

// PPT API calls are ALWAYS routed through the Supabase Edge Function proxy
// (supabase/functions/ppt-proxy). The PPT API key lives in Supabase secrets
// only — it never enters the JS bundle. There is no client-side fallback.

// ── Types ──────────────────────────────────────────────────────────────────────

export type PPTPrice = {
  market: number;  // USD ungraded market price
  low:    number;
  high:   number;
  psa9:   number;  // eBay PSA 9 avg (0 if unavailable)
  psa10:  number;  // eBay PSA 10 avg (0 if unavailable)
  cgc10:  number;  // eBay CGC 10 (bonus data)
  change1d:     number; // % change vs ~1 day ago — primary 今日熱門 ranking signal (0 if no history)
  change7d:     number; // % change vs ~7 days ago (0 if no history)
  change30d:    number; // % change vs ~30 days ago (0 if no history)
  weeklyVolume: number; // eBay weekly sales count (final tiebreak for 今日熱門 ranking; primary is |change1d|)
  history:  { date: string; price: number }[]; // sorted oldest → newest
};

export type PPTCard = {
  tcgPlayerId: string;
  name:        string;
  setName:     string;
  setCode:     string;      // e.g. "WOTC PROMO", "XY-P" — short identifier
  number:      string;      // e.g. "41/53", "290/XY-P" — full card number with total
  language:    'japanese' | 'english' | string;
  image:       string;      // thumbnail (from PPT)
  imageLarge:  string;      // hi-res from pokemontcg.io CDN (constructed from tcgPlayerId)
  price:       PPTPrice;
};

// ── Helpers ───────────────────────────────────────────────────────────────────


function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return 0;
}

/** Parse price history from any shape PPT might return */
function parseHistory(raw: unknown): { date: string; price: number }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((r: any) => ({
        date:  String(r.date ?? r.timestamp ?? r.day ?? ''),
        price: toNum(r.price ?? r.market ?? r.value ?? r.avg ?? 0),
      }))
      .filter(r => r.date && r.price > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw as Record<string, unknown>)
      .map(([date, val]) => ({ date, price: toNum(val) }))
      .filter(r => r.date.match(/^\d{4}-\d{2}-\d{2}/) && r.price > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return [];
}

function calcChange7d(history: { date: string; price: number }[], current: number): number {
  if (history.length < 2 || current === 0) return 0;
  const oldest = history[0].price;
  return oldest > 0 ? ((current - oldest) / oldest) * 100 : 0;
}

/**
 * Compute % change vs a point N days ago in the history series.
 * Returns 0 if we don't have enough data to span the requested window.
 */
function calcChangeNd(
  history: { date: string; price: number }[],
  current: number,
  days: number,
): number {
  if (history.length < 2 || current === 0) return 0;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  // Find the OLDEST entry that's still newer than (now - N days). That's the
  // point closest to "N days ago" — assuming history is sorted ascending.
  let basePoint = history[0];
  for (const h of history) {
    const t = Date.parse(h.date);
    if (Number.isFinite(t) && t <= cutoffMs) basePoint = h;
    else break;
  }
  return basePoint.price > 0 ? ((current - basePoint.price) / basePoint.price) * 100 : 0;
}

/**
 * Revive a cached entry as a PPTCard.
 *
 * The Supabase cache (`card_price_cache.price_json`) stores already-parsed
 * `PPTCard` objects, NOT raw PPT API responses. Earlier versions of cache-
 * read code called `parseCard` on each entry, which expected the raw shape
 * (e.g. `r.prices.market`) and silently returned a card with `price.market=0`
 * when given a parsed entry (where prices live at `r.price.market`).
 *
 * That bug caused 「今日熱門（美版）」on the home screen to disappear after
 * an app restart: cached cards came back with all prices = 0, then the home
 * filter (PSA10 estimate ≥ HK$3,000) removed every card.
 *
 * This helper detects the shape and routes accordingly:
 *   - parsed shape (`r.price.market` exists) → trust as-is, copy through
 *   - raw shape → run through parseCard
 */
function revivePPTCard(r: any): PPTCard | null {
  if (!r || typeof r !== 'object') return null;
  if (r.price && typeof r.price === 'object' && 'market' in r.price) {
    return {
      tcgPlayerId: String(r.tcgPlayerId ?? ''),
      name:        String(r.name ?? ''),
      setName:     String(r.setName ?? ''),
      setCode:     String(r.setCode ?? ''),
      number:      String(r.number ?? ''),
      language:    (r.language === 'japanese' ? 'japanese' : 'english'),
      image:       String(r.image ?? ''),
      imageLarge:  String(r.imageLarge ?? r.image ?? ''),
      price: {
        market:       toNum(r.price.market),
        low:          toNum(r.price.low),
        high:         toNum(r.price.high),
        psa9:         toNum(r.price.psa9),
        psa10:        toNum(r.price.psa10),
        cgc10:        toNum(r.price.cgc10),
        change1d:     toNum(r.price.change1d),
        change7d:     toNum(r.price.change7d),
        change30d:    toNum(r.price.change30d),
        weeklyVolume: toNum(r.price.weeklyVolume),
        history:      Array.isArray(r.price.history) ? r.price.history : [],
      },
    };
  }
  return parseCard(r);
}

function parseCard(raw: any): PPTCard | null {
  if (!raw) return null;
  const name = String(raw.name ?? raw.cardName ?? '').trim();
  if (!name) return null;

  // ── Ungraded market price ──────────────────────────────────────────────────
  const prices = raw.prices ?? raw.price ?? {};
  const market = toNum(prices.market ?? prices.mid ?? prices.low ?? 0);
  const low    = toNum(prices.low ?? 0);
  const high   = toNum(prices.high ?? 0);

  // ── eBay graded prices — actual API shape: ebay.salesByGrade.psa10 ────────
  // salesByGrade keys: "psa10", "psa9", "psa8", "psa7", "cgc10", etc.
  const salesByGrade = raw.ebay?.salesByGrade ?? raw.gradedPrices ?? raw.graded ?? {};

  function gradePrice(grade: string): number {
    const g = salesByGrade[grade];
    if (!g) return 0;
    return toNum(
      g.smartMarketPrice?.price ??  // best estimate from PPT
      g.averagePrice ??
      g.medianPrice ??
      0
    );
  }

  const psa10 = gradePrice('psa10');
  const psa9  = gradePrice('psa9');
  const cgc10 = gradePrice('cgc10');

  // ── Price history ──────────────────────────────────────────────────────────
  // Two series, two roles:
  //   - `history` (returned on the card)  → market-price series, used by the
  //     chart on Card Detail + portfolio chart compatibility. Falls back to
  //     PSA 10 only when no ungraded history exists, to avoid an empty chart.
  //   - `changeHistory` (local var)       → the SAME tier as the displayed
  //     price (PSA 10 if psa10 > 0, else ungraded). Used to compute the
  //     change1d/7d/30d % values shown next to PSA 10 prices and used by
  //     getMarketMovers. Mixing tiers here caused 「今日熱門」rankings to
  //     reflect the wrong tier (Fix A-2, 2026-05-27).
  const ungradedHistory = parseHistory(
    raw.priceHistory ?? raw.history ?? raw.historicalPrices ?? raw.price_history ?? null
  );
  const psa10History = parseHistory(raw.ebay?.priceHistory?.psa10 ?? null);
  const history       = ungradedHistory.length > 0 ? ungradedHistory : psa10History;
  const changeHistory = psa10 > 0 && psa10History.length > 0 ? psa10History : ungradedHistory;

  const refPrice  = psa10 > 0 ? psa10 : market;
  const change1d  = calcChangeNd(changeHistory, refPrice, 1);
  const change7d  = calcChangeNd(changeHistory, refPrice, 7);
  const change30d = calcChangeNd(changeHistory, refPrice, 30);

  // ── Image ──────────────────────────────────────────────────────────────────
  const rawId  = String(raw.tcgPlayerId ?? raw.tcg_player_id ?? raw.id ?? '');
  const image  = String(
    raw.image?.large ?? raw.image?.small ?? raw.imageUrl ??
    raw.image_url ?? (typeof raw.image === 'string' ? raw.image : '') ?? ''
  );

  // Upgrade TCGPlayer CDN thumbnail to higher resolution in-place.
  // tcgplayer-cdn.tcgplayer.com/product/601885_in_200x200.jpg → _400x400.jpg
  // Same correct artwork, no external API needed.
  const imageLarge = image.includes('tcgplayer-cdn.tcgplayer.com')
    ? image.replace(/_in_200x200\.jpg$/i, '_400x400.jpg')
           .replace(/_200x200\.jpg$/i,    '_400x400.jpg')
    : image.includes('images.pokemontcg.io') && !image.includes('_hires')
      ? image.replace(/\.png$/, '_hires.png')
      : image;

  const setName = String(raw.setName ?? raw.set_name ?? raw.set ?? '');
  // PPT often exposes a short set identifier separately — try the common keys.
  // For nested set objects like `{ set: { id, name, code } }` extract `.code` / `.id`.
  const setCode = String(
    raw.setCode ?? raw.set_code ??
    raw.setId   ?? raw.set_id   ??
    (raw.set && typeof raw.set === 'object' ? (raw.set.code ?? raw.set.id ?? '') : '') ??
    ''
  );

  // Card number ("41/53" / "290/XY-P"). PPT field name varies.
  const number = String(
    raw.number ?? raw.cardNumber ?? raw.card_number ??
    raw.collectorNumber ?? raw.collector_number ?? ''
  );

  // Detect language: PPT often omits the field, so infer from card/set name
  let language = String(raw.language ?? '').toLowerCase();
  if (language !== 'japanese' && language !== 'english') {
    const hasJpChars = /[぀-ヿ一-鿿ぁ-ん]/.test(name);
    const hasJpSet   = /japanese|\bS\d|\bSM-|\bS-P\b|\bSVP?\b|\bBW\b|\bXY\b/i.test(setName);
    language = (hasJpChars || hasJpSet) ? 'japanese' : 'english';
  }

  // eBay sales velocity (used for 今日熱門 when price history unavailable)
  const weeklyVolume = toNum(raw.ebay?.salesVelocity?.weeklyAverage ?? 0);

  return {
    tcgPlayerId: rawId,
    name,
    setName,
    setCode,
    number,
    language: language as 'japanese' | 'english',
    image,
    imageLarge,
    price: { market, low, high, psa9, psa10, cgc10, change1d, change7d, change30d, weeklyVolume, history },
  };
}

// ── In-memory cache ────────────────────────────────────────────────────────────

const _hotMem:   { data: PPTCard[]; at: number } = { data: [], at: 0 };
const _hotEnMem: { data: PPTCard[]; at: number } = { data: [], at: 0 };
const _cardMem: Record<string, { data: PPTCard; at: number }> = {};
const HOT_MEM_TTL  = 6  * 60 * 60 * 1000; // 6 hours
const CARD_MEM_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ── Supabase cache helpers ─────────────────────────────────────────────────────

const HOT_CACHE_KEY    = 'ppt_hot_jp_v10'; // v10: PPT call window widened to days:'30' (was '7') so includeHistory:'true' actually returns ≥2 history points; required for change1d/7d/30d to be non-zero in getMarketMovers sort.
const HOT_EN_CACHE_KEY = 'ppt_hot_en_v4';  // v4: fetchHotEnCards now passes includeHistory:'true' + days:'30' (was missing / '7'); EN rail will populate change deltas for the first time.

async function dbReadHot(): Promise<PPTCard[] | null> {
  try {
    const { data } = await supabase
      .from('card_price_cache')
      .select('price_json, fetched_at')
      .eq('cache_key', HOT_CACHE_KEY)
      .single();
    if (!data) return null;
    if (Date.now() - new Date(data.fetched_at).getTime() > HOT_MEM_TTL) return null;
    // Revive cached entries — cache stores PPTCard (already-parsed); use the
    // shape-aware revivePPTCard to avoid the double-parse bug that zeroed out
    // prices and made 今日熱門 disappear after restart.
    const raw: any[] = Array.isArray(data.price_json) ? data.price_json : [];
    return raw.map(r => revivePPTCard(r)).filter((c): c is PPTCard => c !== null);
  } catch { return null; }
}

async function dbWriteHot(cards: PPTCard[]): Promise<void> {
  try {
    await supabase.from('card_price_cache').upsert(
      { cache_key: HOT_CACHE_KEY, price_json: cards, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );
  } catch (e) { if (__DEV__) console.warn('[PPT] dbWriteHot error:', e); }
}

async function dbReadCard(key: string): Promise<PPTCard | null> {
  try {
    const { data } = await supabase
      .from('card_price_cache')
      .select('price_json, fetched_at')
      .eq('cache_key', key)
      .single();
    if (!data) return null;
    if (Date.now() - new Date(data.fetched_at).getTime() > CARD_MEM_TTL) return null;
    // Cache stores parsed PPTCard; use revivePPTCard to avoid double-parse.
    return revivePPTCard(data.price_json) ?? null;
  } catch { return null; }
}

async function dbWriteCard(key: string, card: PPTCard): Promise<void> {
  try {
    await supabase.from('card_price_cache').upsert(
      { cache_key: key, price_json: card, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );
  } catch (e) { if (__DEV__) console.warn('[PPT] dbWriteCard error:', e); }
}

// ── Core fetch ────────────────────────────────────────────────────────────────

// Default per-call timeout. Caller-supplied signals stack with this internal
// timer — whichever aborts first wins.
const PPT_DEFAULT_TIMEOUT_MS = 8000;

async function pptFetch(
  endpoint: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<any> {
  if (__DEV__) console.log('[PPT] →', `${POKEPRICE_BASE_URL}${endpoint}`, params);

  // Compose caller signal + internal timeout. If caller aborts, we abort;
  // if the timeout fires, we abort. Either way the fetch is cancelled.
  const internal = new AbortController();
  const timeout  = setTimeout(() => internal.abort('ppt-timeout'), PPT_DEFAULT_TIMEOUT_MS);
  const onCallerAbort = () => internal.abort('caller-aborted');
  if (signal) {
    if (signal.aborted) { clearTimeout(timeout); return null; }
    signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    // Route through Supabase Edge Function — keeps PPT API key server-side.
    // Send the current Supabase session JWT so the proxy can verify the caller
    // is an authenticated Collectr user before consuming PPT API credits.
    const proxyUrl = `${SUPABASE_URL}/functions/v1/ppt-proxy`;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      if (__DEV__) console.warn('[PPT] No session — skipping fetch');
      return null;
    }
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint, params }),
      signal: internal.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (__DEV__) console.error('[PPT] HTTP ERROR', res.status, errBody);
      return null;
    }
    const json = await res.json();
    if (__DEV__) {
      const arr = json?.data ?? json?.cards ?? [];
      console.log('[PPT] total cards:', arr.length);
      const first = arr[0];
      if (first) {
        const grades  = Object.keys(first?.ebay?.salesByGrade ?? {});
        const psa10   = first?.ebay?.salesByGrade?.psa10;
        const histKey = Object.keys(first?.priceHistory ?? first?.history ?? {});
        console.log('[PPT] first card:', first.name,
          '| market:', first?.prices?.market,
          '| language field:', first?.language ?? 'MISSING',
          '| grades tracked:', grades.join(', ') || 'none',
          '| psa10 avg:', psa10?.averagePrice ?? 'none',
          '| history keys:', histKey.length ? histKey.slice(0,3).join(',') : 'none',
        );
      }
    }
    return json;
  } catch (e: any) {
    // AbortError when caller cancelled or our timeout fired — silent.
    if (e?.name === 'AbortError') {
      if (__DEV__) console.log('[PPT] aborted');
    } else if (__DEV__) {
      console.error('[PPT] fetch error:', e);
    }
    return null;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onCallerAbort);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch top JP cards with 7-day price history + PSA/eBay graded prices.
 * Used for "最有價值" and "今日熱門" on home screen.
 *
 * Cost: limit × 3 credits, cached 6h in Supabase (shared across all users).
 * Filter: PSA10 > $641 USD (≈HK$5,000) after fetch to ensure quality.
 */
export async function fetchHotCards(limit = 30): Promise<PPTCard[]> {
  // Layer 1: in-memory
  if (_hotMem.data.length && Date.now() - _hotMem.at < HOT_MEM_TTL) {
    return _hotMem.data.slice(0, limit);
  }
  // Layer 2: Supabase
  const cached = await dbReadHot();
  if (cached?.length) {
    _hotMem.data = cached; _hotMem.at = Date.now();
    return cached.slice(0, limit);
  }
  // Layer 3: PPT API
  // minPrice=100 (required filter) + includeEbay for real PSA10 prices
  const json = await pptFetch('/cards', {
    language:       'japanese',
    minPrice:       '100',       // USD ≈ HK$780 — pre-filter cheap cards
    sortBy:         'price',
    sortOrder:      'desc',
    includeHistory: 'true',
    includeEbay:    'true',      // PSA9/PSA10 real eBay data (paid plan)
    days:           '30',        // Fix A v2 / Path A — was '7'; PPT 7-day window returned history:[] → change1d/7d/30d all 0 → sort degraded to weeklyVolume.
    limit:          '50',        // fetch 50, then filter down to quality cards
  });
  if (!json) return [];

  const raw: any[] = json.data ?? json.cards ?? (Array.isArray(json) ? json : []);
  const PSA10_MIN_USD = 641; // HK$5,000 / 7.8

  const cards = raw
    .map(r => {
      const c = parseCard(r);
      if (c) c.language = 'japanese'; // explicit: we requested JP
      return c;
    })
    .filter((c): c is PPTCard => {
      if (!c || c.price.market <= 0) return false;
      const hasPsa10   = c.price.psa10 >= PSA10_MIN_USD;
      const highMarket = c.price.market >= 100; // $100 USD ≈ HK$780 fallback
      return hasPsa10 || highMarket;
    })
    .sort((a, b) => {
      // Sort: PSA10 price first, then market price
      const aVal = a.price.psa10 > 0 ? a.price.psa10 : a.price.market;
      const bVal = b.price.psa10 > 0 ? b.price.psa10 : b.price.market;
      return bVal - aVal;
    })
    .slice(0, limit);

  if (cards.length) {
    _hotMem.data = cards; _hotMem.at = Date.now();
    dbWriteHot(cards); // fire-and-forget
  }
  return cards;
}

/**
 * Get full price data for a card by tcgPlayerId (or name/set as fallback).
 * Includes 30-day history and PSA/eBay graded prices.
 *
 * Cost: 3 credits, cached 24h (shared across all users).
 */
export async function getCardPrice(
  tcgPlayerId: string,
  cardName:    string = '',
  setName:     string = '',
  lang:        'japanese' | 'english' = 'english',
): Promise<PPTCard | null> {
  const cacheKey = `ppt_v2_${tcgPlayerId || cardName.toLowerCase().replace(/\W+/g, '_')}`;

  // Layer 1: in-memory
  const mem = _cardMem[cacheKey];
  if (mem && Date.now() - mem.at < CARD_MEM_TTL) return mem.data;

  // Layer 2: Supabase
  const cached = await dbReadCard(cacheKey);
  if (cached) {
    _cardMem[cacheKey] = { data: cached, at: Date.now() };
    return cached;
  }

  // Layer 3: PPT API — 3 credits
  const params: Record<string, string> = {
    language:       lang,
    includeHistory: 'true',
    includeEbay:    'true',   // PSA9/PSA10 real eBay data (paid plan)
    days:           '30',
    limit:          '5',
  };
  if (tcgPlayerId) params.tcgPlayerId = tcgPlayerId;
  else {
    if (cardName) params.search = cardName;
    if (setName)  params.set    = setName;
  }

  const json = await pptFetch('/cards', params);
  if (!json) return null;

  const raw: any[] = json.data ?? json.cards ?? (Array.isArray(json) ? json : []);
  if (!raw.length) return null;

  const nameLower = cardName.toLowerCase();
  const setLower  = setName.toLowerCase();
  const best =
    raw.find(c =>
      (c.name ?? '').toLowerCase().includes(nameLower) &&
      setLower && (c.setName ?? c.set_name ?? '').toLowerCase().includes(setLower)
    ) ??
    raw.find(c => nameLower && (c.name ?? '').toLowerCase().includes(nameLower)) ??
    raw[0];

  const card = parseCard(best);
  if (!card) return null;

  _cardMem[cacheKey] = { data: card, at: Date.now() };
  dbWriteCard(cacheKey, card); // fire-and-forget
  return card;
}

/**
 * Return "hot" cards — sorted by 1-day price movement magnitude.
 *
 * Ranking history:
 *   ≤ v7 cache : eBay weekly sales volume → sticky leaderboard on $641+ JP
 *                grails (1–4 sales/wk per card, same 10 cards monopolise top
 *                slots for weeks)
 *   v8         : |change30d| from generic history → rotation OK but signal
 *                derived from the wrong price tier (ungraded market used for
 *                a PSA 10 rail; see parseCard Fix A-2 comment)
 *   v9 (now)   : |change1d| from per-tier history (psa10History when psa10
 *                > 0, else ungraded). Daily granularity matches the user-
 *                facing label "今日熱門" — every day, biggest one-day movers.
 *
 * Fallback chain: change1d → change7d → change30d → weeklyVolume → market.
 * Each tier degrades gracefully when the previous returns 0 / equal, so a
 * card with sparse history still ranks meaningfully.
 *
 * No API call — works on already-fetched hot cards.
 */
export function getMarketMovers(cards: PPTCard[], limit = 10): PPTCard[] {
  const EPS = 0.01;
  return [...cards]
    .filter(c => c.price.weeklyVolume > 0 || c.price.market > 0)
    .sort((a, b) => {
      // Primary: |change1d| — today's biggest movers (up OR down).
      const d1 = Math.abs(b.price.change1d) - Math.abs(a.price.change1d);
      if (Math.abs(d1) > EPS) return d1;
      // Secondary: |change7d| — covers cards without daily history.
      const d7 = Math.abs(b.price.change7d) - Math.abs(a.price.change7d);
      if (Math.abs(d7) > EPS) return d7;
      // Tertiary: |change30d| — last-resort movement signal.
      const d30 = Math.abs(b.price.change30d) - Math.abs(a.price.change30d);
      if (Math.abs(d30) > EPS) return d30;
      // Quaternary: weekly eBay sales volume (legacy primary).
      const volDiff = b.price.weeklyVolume - a.price.weeklyVolume;
      if (Math.abs(volDiff) > EPS) return volDiff;
      // Quinary: market price (legacy tiebreak).
      return b.price.market - a.price.market;
    })
    .slice(0, limit);
}

/**
 * Fetch top EN cards with PSA/eBay graded prices.
 * Used for "今日熱門（美版）" on home screen and search hot section.
 * Filter: market price ≥ $120 USD (PSA10 estimate ≥ ~HK$2,800).
 * Cost: limit × 3 credits, cached 6h in Supabase.
 */
export async function fetchHotEnCards(limit = 10): Promise<PPTCard[]> {
  // Layer 1: in-memory
  if (_hotEnMem.data.length && Date.now() - _hotEnMem.at < HOT_MEM_TTL) {
    return _hotEnMem.data.slice(0, limit);
  }
  // Layer 2: Supabase
  try {
    const { data: cached } = await supabase
      .from('card_price_cache')
      .select('price_json, fetched_at')
      .eq('cache_key', HOT_EN_CACHE_KEY)
      .single();
    if (cached && Date.now() - new Date((cached as any).fetched_at).getTime() < HOT_MEM_TTL) {
      const raw: any[] = Array.isArray((cached as any).price_json) ? (cached as any).price_json : [];
      // Use revivePPTCard — cache stores parsed PPTCard; re-running parseCard
      // on the parsed shape produces zero-priced cards (which the home filter
      // then drops). See revivePPTCard JSDoc for context.
      const cards = raw.map(r => revivePPTCard(r)).filter((c): c is PPTCard => c !== null);
      if (cards.length) {
        _hotEnMem.data = cards; _hotEnMem.at = Date.now();
        return cards.slice(0, limit);
      }
    }
  } catch { /* cache miss — fall through to API */ }

  // Layer 3: PPT API
  const json = await pptFetch('/cards', {
    language:       'english',
    minPrice:       '120',        // USD — PSA10 estimate ≥ ~HK$2,800
    sortBy:         'price',
    sortOrder:      'desc',
    includeHistory: 'true',       // Fix A v2 / Path A — was missing; without it parseCard's change1d/7d/30d compute to 0 regardless of window.
    includeEbay:    'true',
    days:           '30',         // Fix A v2 / Path A — was '7'; symmetric with JP fetchHotCards.
    limit:          '30',
  });
  if (!json) return [];

  const raw: any[] = json.data ?? json.cards ?? (Array.isArray(json) ? json : []);
  const cards = raw
    .map(r => {
      const c = parseCard(r);
      if (c) c.language = 'english';
      return c;
    })
    .filter((c): c is PPTCard => c !== null && c.price.market > 0)
    .sort((a, b) => {
      const aVal = a.price.psa10 > 0 ? a.price.psa10 : a.price.market * 3;
      const bVal = b.price.psa10 > 0 ? b.price.psa10 : b.price.market * 3;
      return bVal - aVal;
    })
    .slice(0, limit);

  if (cards.length) {
    _hotEnMem.data = cards; _hotEnMem.at = Date.now();
    // fire-and-forget cache write — wrap in Promise.resolve so .catch is available
    // on the PromiseLike returned by the Supabase client.
    Promise.resolve(
      supabase.from('card_price_cache').upsert(
        { cache_key: HOT_EN_CACHE_KEY, price_json: cards, fetched_at: new Date().toISOString() },
        { onConflict: 'cache_key' }
      )
    ).catch(() => {});
  }
  return cards;
}

/**
 * Fetch cards from the same set via PPT API.
 * Used for "related cards" on JP card detail page — returns siblings in the
 * same JP set so users see contextually relevant suggestions instead of
 * pokemontcg.io's EN-only related cards.
 *
 * Multiple matching strategies, tried in order:
 *   1. Strict `set=<setName>` filter (PPT's set filter — exact match)
 *   2. Strict filter using only the SET CODE extracted from a card number
 *      (e.g. "290/XY-P" → "XY-P") — useful when caller passes a full set
 *      name like "Black Star Promo XY-P" but PPT stores it as just "XY-P".
 *   3. Text `search` query + post-filter — catches partial / fuzzy matches
 *      when set name has slight variations (capitalisation, "Special",
 *      "Promo" suffixes, etc.).
 *
 * `cardNumber` is an optional hint like "290/XY-P" or "234/192" — only the
 * portion AFTER "/" is used (the "set code" — usually 2-6 chars).
 *
 * Cost: 2 credits per call (each strategy is one call; bail early on hit).
 */
export async function getPPTCardsBySet(
  setName:    string,
  lang:       'japanese' | 'english' = 'japanese',
  limit:      number = 12,
  cardNumber: string = '',   // e.g. "290/XY-P" — used for fallback
): Promise<PPTCard[]> {
  const trimmedSet = setName.trim();
  if (!trimmedSet && !cardNumber) return [];

  // Helper — fetch and parse with given params
  const tryFetch = async (params: Record<string, string>): Promise<PPTCard[]> => {
    const json = await pptFetch('/cards', params);
    if (!json) return [];
    const raw: any[] = json.data ?? json.cards ?? (Array.isArray(json) ? json : []);
    return raw
      .map(r => {
        const c = parseCard(r);
        if (c) c.language = lang;
        return c;
      })
      .filter((c): c is PPTCard => c !== null);
  };

  // ── Strategy 1: exact `set` filter ──────────────────────────────────
  if (trimmedSet) {
    const r1 = await tryFetch({
      set:         trimmedSet,
      language:    lang,
      includeEbay: 'true',
      limit:       String(limit),
    });
    if (r1.length > 0) {
      if (__DEV__) console.log('[PPT related] strategy 1 (set):', trimmedSet, '→', r1.length);
      return r1;
    }
  }

  // ── Strategy 2: set code from card number (e.g. "290/XY-P" → "XY-P") ──
  // Match anything after the last "/" — but REQUIRE at least one letter, so
  // we don't treat a pure-numeric total (e.g. "41/53" → "53") as a set code.
  // "/XY-P", "/BW-P", "/S-P" qualify; "/53", "/192" don't.
  const codeMatch = cardNumber.match(/\/([A-Za-z][\w-]*|[\w-]*[A-Za-z][\w-]*)\s*$/);
  const setCode = codeMatch ? codeMatch[1] : '';
  if (setCode && setCode.length >= 2 && setCode !== trimmedSet) {
    const r2 = await tryFetch({
      set:         setCode,
      language:    lang,
      includeEbay: 'true',
      limit:       String(limit),
    });
    if (r2.length > 0) {
      if (__DEV__) console.log('[PPT related] strategy 2 (set code):', setCode, '→', r2.length);
      return r2;
    }
  }

  // ── Strategy 3: text `search` + post-filter ──────────────────────────
  // Use the most distinctive token from setName (or set code) as search.
  const searchTerm = setCode || trimmedSet;
  if (!searchTerm) return [];
  const r3 = await tryFetch({
    search:      searchTerm,
    language:    lang,
    includeEbay: 'true',
    limit:       String(limit * 3),     // wider net since we post-filter
  });
  if (r3.length === 0) {
    if (__DEV__) console.log('[PPT related] all strategies returned 0 for', { setName: trimmedSet, cardNumber });
    return [];
  }

  // Post-filter: keep cards whose setName overlaps with our setName / code
  const setLower  = trimmedSet.toLowerCase();
  const codeLower = setCode.toLowerCase();
  const filtered = r3.filter(c => {
    const csl = (c.setName ?? '').toLowerCase();
    if (!csl) return false;
    if (setLower  && (csl.includes(setLower)  || setLower.includes(csl))) return true;
    if (codeLower && csl.includes(codeLower)) return true;
    return false;
  }).slice(0, limit);

  if (__DEV__) console.log('[PPT related] strategy 3 (search):', searchTerm, '→', r3.length, 'raw,', filtered.length, 'filtered');
  return filtered;
}

/**
 * Search JP cards by name via PPT API.
 * Used for search screen 日版 results — returns real PSA prices immediately.
 * Cost: ~2 credits per call (search + eBay), debounced in UI.
 */
export async function searchJPCards(name: string, limit = 100, signal?: AbortSignal): Promise<PPTCard[]> {
  if (!name.trim()) return [];
  const json = await pptFetch('/cards', {
    search:      name.trim(),
    language:    'japanese',
    includeEbay: 'true',
    limit:       String(limit),
  }, signal);
  if (!json) return [];
  const raw: any[] = json.data ?? json.cards ?? (Array.isArray(json) ? json : []);
  return raw
    .map(r => {
      const c = parseCard(r);
      if (c) c.language = 'japanese';
      return c;
    })
    .filter((c): c is PPTCard => c !== null);
}

/**
 * Search EN cards by name via PPT API.
 * Used for search screen 美版 results — returns real eBay PSA prices.
 * Cost: ~2 credits per call, debounced in UI.
 */
export async function searchENCards(name: string, limit = 100, signal?: AbortSignal): Promise<PPTCard[]> {
  if (!name.trim()) return [];
  const json = await pptFetch('/cards', {
    search:      name.trim(),
    language:    'english',
    includeEbay: 'true',
    limit:       String(limit),
  }, signal);
  if (!json) return [];
  const raw: any[] = json.data ?? json.cards ?? (Array.isArray(json) ? json : []);
  return raw
    .map(r => {
      const c = parseCard(r);
      if (c) c.language = 'english';
      return c;
    })
    .filter((c): c is PPTCard => c !== null)
    .sort((a, b) => {
      // Sort: highest eBay PSA10 first, then market price
      const aVal = a.price.psa10 > 0 ? a.price.psa10 : a.price.market;
      const bVal = b.price.psa10 > 0 ? b.price.psa10 : b.price.market;
      return bVal - aVal;
    });
}

/**
 * Map PPTCard price to the JTCGPrice-compatible shape used
 * by existing PSA price display logic (getPSAPrice, etc.).
 */
export function pptPriceCompat(card: PPTCard): {
  market: number; low: number; high: number; psa9: number; psa10: number;
} {
  return {
    market: card.price.market,
    low:    card.price.low,
    high:   card.price.high,
    psa9:   card.price.psa9,
    psa10:  card.price.psa10,
  };
}

/**
 * Return the `fetched_at` timestamp of the most recent Supabase HOT cache row
 * for the requested rail. Used by the Home tab freshness chip ("資料更新於 N 分鐘前").
 *
 * Returns null when:
 *   - the row doesn't exist yet (first ever launch on a clean cache),
 *   - the Supabase query errors,
 *   - the row exists but `fetched_at` is malformed.
 *
 * Reads only — no cache-key bump or refetch side effect.
 */
export async function getHotCacheTimestamp(
  rail: 'jp' | 'en'
): Promise<Date | null> {
  const cacheKey = rail === 'jp' ? HOT_CACHE_KEY : HOT_EN_CACHE_KEY;
  try {
    const { data, error } = await supabase
      .from('card_price_cache')
      .select('fetched_at')
      .eq('cache_key', cacheKey)
      .single();
    if (error || !data?.fetched_at) return null;
    return new Date(data.fetched_at as string);
  } catch {
    return null;
  }
}
