-- artofpkm_card_images
-- Stores artofpkm.com image URLs for JP Pokémon TCG cards
-- Key format: "{localId padded to 3 digits}/{setCode}"  e.g. "293/XY-P", "001/SV-P"

CREATE TABLE IF NOT EXISTS public.artofpkm_card_images (
  key         TEXT PRIMARY KEY,          -- "293/XY-P"
  image_url   TEXT NOT NULL,             -- https://www.artofpkm.com/rails/active_storage/...
  set_code    TEXT GENERATED ALWAYS AS (split_part(key, '/', 2)) STORED,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for filtering by set code (e.g. find all XY-P cards)
CREATE INDEX IF NOT EXISTS idx_artofpkm_set_code ON public.artofpkm_card_images (set_code);

-- RLS: public read, no write from client
ALTER TABLE public.artofpkm_card_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read artofpkm images"
  ON public.artofpkm_card_images
  FOR SELECT
  USING (true);

-- Optional: comment for documentation
COMMENT ON TABLE public.artofpkm_card_images IS
  'JP Pokémon TCG card image URLs scraped from artofpkm.com. '
  'Key = localId/setCode (e.g. 293/XY-P). '
  'Covers promo sets: XY-P, SM-P, SV-P, M-P, S-P plus trainer/character cards.';
