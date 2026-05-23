// Pokemon TCG API (pokemontcg.io) — card images & EN card data
//
// NOTE: This key is intentionally still exposed via EXPO_PUBLIC_* — pokemontcg.io
// uses public API keys (rate-limit identification only, no billing risk).
// If you ever switch to a paid tier, move this to an Edge Function proxy.
export const POKEMON_TCG_API_KEY: string =
  process.env.EXPO_PUBLIC_POKEMON_TCG_KEY ?? '';
export const POKEMON_TCG_BASE_URL = 'https://api.pokemontcg.io/v2';

// JP series names in pokemontcg.io
export const JP_SERIES = [
  'Scarlet & Violet (Japanese)',
  'Sword & Shield (Japanese)',
  'Sun & Moon (Japanese)',
  'XY (Japanese)',
  'Black & White (Japanese)',
];

// Supabase project URL (used for Edge Function proxy calls)
export const SUPABASE_URL: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// PokemonPriceTracker base URL — proxied through supabase/functions/ppt-proxy.
// The API key (POKEPRICE_API_KEY) lives ONLY in Supabase secrets — never bundled.
export const POKEPRICE_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2';

// HKD 換算率（從 USD 換算）
export const USD_TO_HKD = 7.8;

// Seller upload limits (max active listings per seller type)
export const SELLER_UPLOAD_LIMITS: Record<string, number> = {
  certified_merchant: 100,
  individual_seller:  10,
};

// Listing price bounds (HKD)
export const LISTING_PRICE_MIN = 1;
export const LISTING_PRICE_MAX = 999999;
