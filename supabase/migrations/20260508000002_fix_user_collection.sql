-- ============================================================================
-- 修復 user_collection 表格欄位問題
-- 完全重建為 App 前端所需的 schema
-- ============================================================================

-- 先刪除舊版（CASCADE 會一併移除相關的 index / policy）
DROP TABLE IF EXISTS public.user_collection CASCADE;

-- 重建正確版本
CREATE TABLE public.user_collection (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id        text          NOT NULL,
  card_name      text,
  set_name       text,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  current_price  numeric(12,2) NOT NULL DEFAULT 0,
  quantity       int           NOT NULL DEFAULT 1 CHECK (quantity > 0),
  psa_grade      text,
  image_url      text,
  added_at       timestamptz   NOT NULL DEFAULT now(),
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX user_collection_user_idx ON public.user_collection (user_id, added_at DESC);
CREATE INDEX user_collection_card_idx ON public.user_collection (card_id);

-- Row Level Security
ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_collection owner all"
  ON public.user_collection
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
