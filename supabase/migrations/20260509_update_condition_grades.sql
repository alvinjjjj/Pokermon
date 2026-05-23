-- ============================================================
-- 更新 listings.condition 品相系統
-- Raw / PSA 9 / PSA 10
-- ============================================================

-- 1. 先刪除舊的 check constraint
alter table public.listings
  drop constraint if exists listings_condition_check;

-- 2. 將舊資料遷移（先更新，才加新 constraint）
update public.listings
  set condition = 'Raw'
  where condition in ('NM', 'LP', 'MP', 'HP', 'D');

-- 3. 加入新的 check constraint
alter table public.listings
  add constraint listings_condition_check
  check (condition in ('Raw', 'PSA 9', 'PSA 10'));
