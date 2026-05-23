-- tcg_price_snapshots: daily price history keyed by Pokemon TCG API card ID (text)
-- Written by the client when a user views a card detail page.
-- Used to build real price charts after enough data accumulates (7+ days).
-- One row per card per day (upsert on conflict).

CREATE TABLE IF NOT EXISTS public.tcg_price_snapshots (
  tcg_card_id  text          NOT NULL,
  date         date          NOT NULL DEFAULT CURRENT_DATE,
  price_usd    numeric(12,4) NOT NULL,  -- raw market price
  psa10_usd    numeric(12,4),           -- PSA 10 price (null if not available)
  psa9_usd     numeric(12,4),           -- PSA 9 price (null if not available)
  source       text          NOT NULL DEFAULT 'api',
  created_at   timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (tcg_card_id, date)
);

CREATE INDEX IF NOT EXISTS tcg_price_snapshots_card_date_idx
  ON public.tcg_price_snapshots (tcg_card_id, date DESC);

ALTER TABLE public.tcg_price_snapshots ENABLE ROW LEVEL SECURITY;

-- Anyone can read price history
CREATE POLICY "snapshots read"
  ON public.tcg_price_snapshots FOR SELECT
  USING (true);

-- Only authenticated users can insert/update (prevents anonymous price tampering)
CREATE POLICY "snapshots insert"
  ON public.tcg_price_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Required for upsert ON CONFLICT UPDATE — authenticated only
CREATE POLICY "snapshots update"
  ON public.tcg_price_snapshots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
