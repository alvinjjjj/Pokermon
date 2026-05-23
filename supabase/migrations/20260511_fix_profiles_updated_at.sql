-- ============================================================
-- Fix: profiles 表缺少 updated_at 欄位
-- 問題：set_updated_at() trigger 在 BEFORE UPDATE 時嘗試設定
--       NEW.updated_at = now()，但欄位不存在 → 42703 error
--       導致所有 profiles UPDATE（改名、改 bio 等）全部失敗
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 把現有 row 的 updated_at 設成 created_at（最合理的預設值）
UPDATE public.profiles
  SET updated_at = created_at
  WHERE updated_at = now() AND created_at < now() - interval '1 second';
