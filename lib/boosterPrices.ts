/**
 * Booster box price service.
 *
 * Price resolution order:
 *  1. Supabase cache (if < 3 days old)        — fastest, no API call
 *  2. PriceCharting API (if token configured)  — live sealed-product prices
 *  3. Static fallback from BOOSTER_SETS        — always available
 *
 * Results are written back to Supabase so the next call hits the cache.
 */

import { SUPABASE_URL } from '../constants/config';
import { BoosterSet } from '../constants/boosterBoxes';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BoxPrices = {
  pack_usd: number;
  box_usd: number;
  /** 'pricecharting' | 'static' | 'cache' */
  source: string;
  updated_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUsd(cents: unknown): number {
  const n = typeof cents === 'number' ? cents : parseFloat(String(cents ?? '0'));
  return isNaN(n) ? 0 : n / 100;
}

// ─── PriceCharting lookup (via Supabase Edge Function proxy) ──────────────────

/**
 * Call the pc-proxy Edge Function. Returns parsed JSON or null on failure.
 * The proxy injects the PRICECHARTING_TOKEN server-side and verifies the user's JWT.
 */
async function pcProxyFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/pc-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint, params }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Attempt to fetch sealed-product price from PriceCharting for a given set.
 * Returns null if the API is unavailable or no match found.
 */
async function fetchPriceCharting(set: BoosterSet): Promise<BoxPrices | null> {
  try {
    // If a specific product ID is known, use the direct endpoint
    if (set.pricechartingId) {
      const d = await pcProxyFetch('/api/product', { id: set.pricechartingId });
      if (d) {
        const box_usd  = toUsd(d['complete-price']) || toUsd(d['loose-price']);
        const pack_usd = box_usd > 0 ? box_usd / set.packsPerBox : 0;
        if (box_usd > 0) {
          return { pack_usd, box_usd, source: 'pricecharting', updated_at: new Date().toISOString() };
        }
      }
    }

    // Fall back to text search
    const q = `pokemon japanese ${set.nameEN} booster box`;
    const searchJson = await pcProxyFetch('/api/products', { q });
    if (!searchJson) return null;

    const products: any[] = searchJson.products ?? searchJson.data ?? [];

    // Find best match: product name contains "booster box" and the set name
    const setWords = set.nameEN.toLowerCase().split(' ');
    const best = products.find(p => {
      const name = (p.product_name ?? p.name ?? '').toLowerCase();
      return name.includes('booster box') && setWords.some(w => name.includes(w));
    }) ?? products[0];

    if (!best?.id) return null;

    const pd = await pcProxyFetch('/api/product', { id: String(best.id) });
    if (!pd) return null;

    const box_usd = toUsd(pd['complete-price']) || toUsd(pd['loose-price']);
    if (box_usd <= 0) return null;

    const pack_usd = box_usd / set.packsPerBox;
    return { pack_usd, box_usd, source: 'pricecharting', updated_at: new Date().toISOString() };
  } catch (err) {
    if (__DEV__) console.warn('[BoosterPrices] PriceCharting error:', err);
    return null;
  }
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function readCache(setId: string): Promise<BoxPrices | null> {
  try {
    const { data } = await supabase
      .from('booster_box_prices')
      .select('pack_usd, box_usd, source, updated_at')
      .eq('set_id', setId)
      .single();

    if (!data) return null;

    const ageMs = Date.now() - new Date(data.updated_at).getTime();
    if (ageMs > CACHE_TTL_MS) return null;   // stale

    return { ...data, source: 'cache' };
  } catch {
    return null;
  }
}

async function writeCache(setId: string, prices: BoxPrices): Promise<void> {
  try {
    await supabase.from('booster_box_prices').upsert({
      set_id:     setId,
      pack_usd:   prices.pack_usd,
      box_usd:    prices.box_usd,
      source:     prices.source,
      updated_at: prices.updated_at,
    });
  } catch (err) {
    console.warn('[BoosterPrices] cache write error:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get pack + box prices for a single booster set.
 *
 * Resolution order: Supabase cache → PriceCharting API → static fallback.
 */
export async function getBoxPrices(set: BoosterSet): Promise<BoxPrices> {
  // 1. Fast cache hit
  const cached = await readCache(set.id);
  if (cached) return cached;

  // 2. Live API
  const live = await fetchPriceCharting(set);
  if (live) {
    await writeCache(set.id, live);
    return live;
  }

  // 3. Static fallback — seed cache so next call is fast
  const fallback: BoxPrices = {
    pack_usd:   set.packMarketUSD,
    box_usd:    set.boxMarketUSD,
    source:     'static',
    updated_at: new Date().toISOString(),
  };
  await writeCache(set.id, fallback);
  return fallback;
}

/**
 * Fetch prices for multiple sets in parallel.
 * Returns a map of set_id → BoxPrices.
 */
export async function getBoxPricesMap(
  sets: BoosterSet[]
): Promise<Record<string, BoxPrices>> {
  const pairs = await Promise.all(
    sets.map(s => getBoxPrices(s).then(p => [s.id, p] as const))
  );
  return Object.fromEntries(pairs);
}
