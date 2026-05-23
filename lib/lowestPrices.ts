import { supabase } from './supabase';

export type LowestListing = {
  listing_id: string;
  price: number;        // HKD
};

/**
 * Batch-fetch the cheapest active certified-merchant listing for each card.
 * Returns a map of  card_id → { listing_id, price }
 */
export async function fetchLowestPrices(
  cardIds: string[]
): Promise<Record<string, LowestListing>> {
  if (!cardIds.length) return {};

  const { data } = await supabase
    .from('listings')
    .select('id, card_id, price')
    .in('card_id', cardIds)
    .eq('status', 'active')
    .eq('seller_type', 'certified_merchant')
    .order('price', { ascending: true })
    .limit(cardIds.length * 10); // at most 10 listings per card — avoids PostgREST 1000-row default cap

  const result: Record<string, LowestListing> = {};
  for (const row of data ?? []) {
    // Because we order ASC, the first hit per card_id is the cheapest
    if (!result[row.card_id]) {
      result[row.card_id] = { listing_id: row.id, price: row.price };
    }
  }
  return result;
}
