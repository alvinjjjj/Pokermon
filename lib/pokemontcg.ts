import { supabase } from './supabase';

type SearchCardsParams = {
  q: string;
  pageSize?: number;
  orderBy?: string;
};

export async function searchCards(
  params: SearchCardsParams
): Promise<{ data: any[] } | null> {
  const { data, error } = await supabase.functions.invoke('pokemontcg-proxy', {
    body: { op: 'searchCards', ...params },
  });
  if (error) {
    console.error('searchCards', error);
    return null;
  }
  return data as { data: any[] };
}

export async function getCard(
  id: string
): Promise<{ data: any } | null> {
  const { data, error } = await supabase.functions.invoke('pokemontcg-proxy', {
    body: { op: 'getCard', id },
  });
  if (error) {
    console.error('getCard', error);
    return null;
  }
  return data as { data: any };
}

// ── EN image lookup (Issue #2/#3, phase 1B) ─────────────────────────────────
//
// `searchCardImages` exists to rescue EN cards whose PPT-supplied image URL
// is on tcgplayer-cdn.tcgplayer.com — these 403 when hotlinked from React
// Native, so the rail renders empty rectangles. pokemontcg.io's
// images.pokemontcg.io CDN is the only reliable EN image source we have.
//
// Mirrors the role of fetchHiresJPImages (lib/jpImages.ts) but the input is
// just card names (no setName needed — first matching card across all sets
// wins, which is fine because we only care about the artwork URL).
//
// Cache lifetime is the JS-runtime — cleared on logout via clearEnImageCache
// (account-switch privacy + JP-side symmetry). Negative results (no match in
// pokemontcg.io) are cached as `null` so we don't retry on every render.
const enImageCache = new Map<string, string | null>();

/**
 * Batch-look-up pokemontcg.io image URLs for a list of EN card names.
 * Returns Map<lowercase-name, image_url> for names that resolved. Unmatched
 * names are simply omitted — caller decides whether to render a placeholder.
 *
 * Implementation:
 *   - Memory cache short-circuits names we've already resolved (or already
 *     failed to resolve — null cache prevents retry storms).
 *   - Uncached names are chunked into groups of 15 (Lucene OR query gets long
 *     fast; ~15 names keeps the request URL well under any reverse-proxy
 *     limit and stays within pokemontcg.io's pageSize cap).
 *   - First matching card per name wins. Many EN sets reprint the same
 *     character (e.g. "Charizard ex" exists in multiple sets) — for image
 *     purposes any reliable URL is acceptable. We do NOT try to match the
 *     specific set the caller had in mind.
 *
 * Failure modes:
 *   - searchCards throws / proxy errors → all uncached names cached as null
 *     and excluded from the result.
 *   - Individual chunk fails → only those chunk names cached as null; other
 *     chunks still contribute. Best-effort, never throws.
 */
export async function searchCardImages(
  names: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // Apply cache hits first; collect names that need a network round-trip.
  const uncached: string[] = [];
  for (const n of names) {
    const key = n.toLowerCase();
    if (enImageCache.has(key)) {
      const cached = enImageCache.get(key);
      if (cached) result.set(key, cached);
    } else {
      uncached.push(n);
    }
  }
  if (uncached.length === 0) return result;

  // Chunk to keep Lucene query length and pageSize manageable.
  const CHUNK = 15;
  for (let i = 0; i < uncached.length; i += CHUNK) {
    const chunk = uncached.slice(i, i + CHUNK);
    // Lucene: name:"X" OR name:"Y" — double-quoted to force exact-phrase match,
    // backslash-escape any embedded quotes (rare but possible in card names).
    const query = chunk
      .map(n => `name:"${n.replace(/"/g, '\\"')}"`)
      .join(' OR ');
    try {
      // searchCards routes through the pokemontcg-proxy edge function (same
      // path as the existing API consumers in this file). pageSize of 100 is
      // a comfortable upper bound for 15-name chunks where each name may
      // resolve to several reprints.
      const res = await searchCards({ q: query, pageSize: 100 });
      const cards = (res?.data ?? []) as Array<{
        name?: string;
        images?: { small?: string; large?: string };
      }>;

      // Index returned cards by lowercase name; first-seen wins.
      const found = new Map<string, string>();
      for (const card of cards) {
        const key = (card.name ?? '').toLowerCase();
        const img = card.images?.large || card.images?.small;
        if (key && img && !found.has(key)) found.set(key, img);
      }

      // Cache hit-or-miss for every name in the chunk so subsequent calls
      // can short-circuit. A `null` entry means "we looked and pokemontcg.io
      // had no match" — don't retry.
      for (const n of chunk) {
        const key = n.toLowerCase();
        const url = found.get(key);
        enImageCache.set(key, url ?? null);
        if (url) result.set(key, url);
      }
    } catch {
      // Network / proxy failure for this chunk — cache null so we don't
      // re-spam, but leave the other chunks free to succeed.
      for (const n of chunk) {
        if (!enImageCache.has(n.toLowerCase())) {
          enImageCache.set(n.toLowerCase(), null);
        }
      }
    }
  }

  return result;
}

/**
 * Clear the EN image-URL memory cache. Wire this to the auth SIGNED_OUT
 * handler so account-switch users do not see the previous user's image
 * lookups (low-risk leak, but JP-side does the same via clearJpImageCaches).
 */
export function clearEnImageCache(): void {
  enImageCache.clear();
}
