import { supabase } from './supabase';

/**
 * Given a card_name like "Mario Pikachu - 293/XY-P",
 * extracts the artofpkm key "293/XY-P" and looks up the image URL.
 */
export function extractArtofpkmKey(cardName: string): string | null {
  const m = cardName?.match(/[-–]\s*0*(\d+)\s*\/\s*([A-Za-z0-9-]+)\s*$/);
  if (!m) return null;
  return `${m[1].padStart(3, '0')}/${m[2].toUpperCase()}`;
}

// Module-level cache (key → image_url). Survives across screen focus/unfocus
// so my-listings / shops don't re-query Supabase for the same cards on every
// useFocusEffect fire. Cleared only on app restart, which matches the typical
// lifetime of artofpkm_card_images rows.
const _imageCache = new Map<string, string>();
// Negative cache: keys we've already failed to find, so we don't retry forever.
const _missCache  = new Set<string>();

/** Clear both caches. Call on logout to prevent cross-user state leakage. */
export function clearArtofpkmCaches(): void {
  _imageCache.clear();
  _missCache.clear();
}

/**
 * For a list of items with card_name + card_image_url + photo_urls,
 * returns a map of { card_name → artofpkm image_url } for items missing
 * a real user-uploaded photo. Note: items with `card_image_url` may still
 * be queried because that URL is often a broken Pokemon TCG API placeholder
 * for JP promos.
 */
export async function fetchArtofpkmImages(
  items: Array<{ card_name: string; card_image_url?: string | null; photo_urls?: string[] }>
): Promise<Record<string, string>> {
  // Only look up items where the user hasn't supplied their own photo.
  const missing = items.filter(l => !l.photo_urls?.[0]);
  if (!missing.length) return {};

  const result:   Record<string, string> = {};
  const toFetch:  { name: string; key: string }[] = [];

  for (const l of missing) {
    const key = extractArtofpkmKey(l.card_name);
    if (!key) continue;
    if (_imageCache.has(key)) {
      result[l.card_name] = _imageCache.get(key)!;
      continue;
    }
    if (_missCache.has(key)) continue;          // already known to be missing
    toFetch.push({ name: l.card_name, key });
  }

  if (!toFetch.length) return result;

  // Batch-query Supabase for everything we haven't seen
  const uniqueKeys = [...new Set(toFetch.map(t => t.key))];
  const { data } = await supabase
    .from('artofpkm_card_images')
    .select('key, image_url')
    .in('key', uniqueKeys);

  const fetched = new Map<string, string>();
  for (const row of data ?? []) fetched.set(row.key, row.image_url);

  for (const { name, key } of toFetch) {
    const url = fetched.get(key);
    if (url) {
      _imageCache.set(key, url);
      result[name] = url;
    } else {
      _missCache.add(key);
    }
  }
  return result;
}
