-- ============================================================
-- HKCARDCOLL — Merchant System
-- 建立日期：2026-05-09
-- 包含：user_roles, merchant_profiles, listings,
--       hk_market_prices, hk_price_history
--       + RLS policies + HK price auto-update function
-- ============================================================

-- ─── 1. user_roles ───────────────────────────────────────────
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'viewer'
               check (role in ('viewer', 'individual_seller', 'certified_merchant')),
  status     text not null default 'active'
               check (status in ('active', 'pending', 'rejected')),
  created_at timestamptz not null default now()
);

-- 每個新用戶自動建立 viewer 角色
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_roles (user_id, role, status)
  values (new.id, 'viewer', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- RLS
alter table public.user_roles enable row level security;

create policy "用戶可讀自己的角色"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "用戶可更新自己的角色"
  on public.user_roles for update
  using (auth.uid() = user_id);

create policy "service role 全權限"
  on public.user_roles for all
  using (auth.role() = 'service_role');

-- ─── 2. merchant_profiles ────────────────────────────────────
create table if not exists public.merchant_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique not null references auth.users(id) on delete cascade,
  seller_type         text not null
                        check (seller_type in ('individual_seller', 'certified_merchant')),

  -- 共用欄位
  display_name        text not null,
  avatar_url          text,
  district            text,
  contact_type        text check (contact_type in ('WhatsApp', 'Telegram', 'Instagram')),
  contact_value       text,
  payment_methods     text[] default '{}',

  -- 個人賣家
  declaration_agreed  boolean default false,

  -- 認證商家
  shop_name_zh        text,
  shop_name_en        text,
  logo_url            text,
  banner_url          text,
  br_number           text,
  br_document_url     text,
  has_physical_store  boolean default false,
  address             text,
  business_hours      text,
  whatsapp            text,
  website             text,
  instagram           text,
  shop_description    text check (char_length(shop_description) <= 200),

  -- 狀態
  status              text not null default 'pending'
                        check (status in ('active', 'pending', 'rejected')),
  rejection_reason    text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 個人賣家提交後自動 active
create or replace function public.auto_approve_individual_seller()
returns trigger language plpgsql as $$
begin
  if new.seller_type = 'individual_seller' then
    new.status := 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists auto_approve_seller on public.merchant_profiles;
create trigger auto_approve_seller
  before insert on public.merchant_profiles
  for each row execute function public.auto_approve_individual_seller();

-- 自動更新 updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists merchant_profiles_updated_at on public.merchant_profiles;
create trigger merchant_profiles_updated_at
  before update on public.merchant_profiles
  for each row execute function public.set_updated_at();

-- RLS
alter table public.merchant_profiles enable row level security;

create policy "任何人可讀 active 商家"
  on public.merchant_profiles for select
  using (status = 'active' or auth.uid() = user_id);

create policy "用戶可建立自己的商家檔案"
  on public.merchant_profiles for insert
  with check (auth.uid() = user_id);

create policy "用戶可更新自己的商家檔案"
  on public.merchant_profiles for update
  using (auth.uid() = user_id);

create policy "service role 全權限"
  on public.merchant_profiles for all
  using (auth.role() = 'service_role');

-- ─── 3. listings ─────────────────────────────────────────────
create table if not exists public.listings (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  merchant_id     uuid references public.merchant_profiles(id) on delete set null,
  seller_type     text not null
                    check (seller_type in ('individual_seller', 'certified_merchant')),

  -- 卡牌資料（來自 pokemontcg.io）
  card_id         text,
  card_name       text not null,
  set_name        text,
  rarity          text,
  card_image_url  text,

  -- 實物照片（最多4張）
  photo_urls      text[] default '{}',

  -- 商品資料
  condition       text not null
                    check (condition in ('NM', 'LP', 'MP', 'HP', 'D')),
  price           numeric not null check (price > 0),
  is_negotiable   boolean default false,
  quantity        integer not null default 1 check (quantity > 0),
  language        text[] default '{}',
  notes           text check (char_length(notes) <= 100),

  -- 狀態
  status          text not null default 'active'
                    check (status in ('active', 'sold', 'hidden')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- 上傳限制：個人賣家 10 張，認證商家 100 張
create or replace function public.check_listing_limit()
returns trigger language plpgsql as $$
declare
  current_count integer;
  upload_limit  integer;
  seller_type   text;
begin
  select mp.seller_type into seller_type
    from public.merchant_profiles mp
    where mp.user_id = new.seller_id;

  if seller_type = 'certified_merchant' then
    upload_limit := 100;
  else
    upload_limit := 10;
  end if;

  select count(*) into current_count
    from public.listings
    where seller_id = new.seller_id
      and status != 'sold';

  if current_count >= upload_limit then
    raise exception '已達上傳上限（%件）', upload_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_listing_limit on public.listings;
create trigger enforce_listing_limit
  before insert on public.listings
  for each row execute function public.check_listing_limit();

-- RLS
alter table public.listings enable row level security;

create policy "任何人可讀 active listing"
  on public.listings for select
  using (status = 'active' or auth.uid() = seller_id);

create policy "賣家可建立 listing"
  on public.listings for insert
  with check (auth.uid() = seller_id);

create policy "賣家可更新自己的 listing"
  on public.listings for update
  using (auth.uid() = seller_id);

create policy "賣家可刪除自己的 listing"
  on public.listings for delete
  using (auth.uid() = seller_id);

-- ─── 4. hk_market_prices ─────────────────────────────────────
-- 只收錄認證商家（Tier 2）的定價，每日自動更新
create table if not exists public.hk_market_prices (
  id                          uuid primary key default gen_random_uuid(),
  card_id                     text not null,
  card_name                   text not null,
  set_name                    text,
  card_image_url              text,
  lowest_price                numeric,
  average_price               numeric,
  highest_price               numeric,
  lowest_price_merchant_id    uuid references public.merchant_profiles(id) on delete set null,
  lowest_price_merchant_name  text,
  lowest_price_district       text,
  merchant_count              integer default 0,
  recorded_at                 timestamptz not null default now()
);

create unique index if not exists hk_market_prices_card_idx
  on public.hk_market_prices(card_id);

-- RLS（價格資料公開可讀）
alter table public.hk_market_prices enable row level security;

create policy "任何人可讀 HK 市場價"
  on public.hk_market_prices for select
  using (true);

create policy "service role 可寫 HK 市場價"
  on public.hk_market_prices for all
  using (auth.role() = 'service_role');

create policy "authenticated 可寫 HK 市場價"
  on public.hk_market_prices for all
  using (auth.role() = 'authenticated');

-- ─── 5. hk_price_history ─────────────────────────────────────
-- 用於付費功能：30 / 90 / 180 日走勢
create table if not exists public.hk_price_history (
  id          uuid primary key default gen_random_uuid(),
  card_id     text not null,
  card_name   text not null,
  avg_price   numeric,
  low_price   numeric,
  high_price  numeric,
  date        date not null default current_date
);

create unique index if not exists hk_price_history_unique
  on public.hk_price_history(card_id, date);

alter table public.hk_price_history enable row level security;

create policy "任何人可讀價格歷史"
  on public.hk_price_history for select
  using (true);

create policy "service role 可寫價格歷史"
  on public.hk_price_history for all
  using (auth.role() = 'service_role');

-- ─── 6. 自動更新 HK 市場價 function ─────────────────────────
-- 當認證商家的 listing 新增/更新/刪除時，重新計算該卡的市場價
create or replace function public.refresh_hk_market_price(p_card_id text)
returns void language plpgsql security definer as $$
declare
  v_lowest     numeric;
  v_average    numeric;
  v_highest    numeric;
  v_count      integer;
  v_merchant_id uuid;
  v_merchant_name text;
  v_district   text;
  v_card_name  text;
  v_set_name   text;
  v_image_url  text;
begin
  -- 只取認證商家的 active listing
  select
    min(l.price),
    avg(l.price),
    max(l.price),
    count(distinct l.merchant_id),
    l.card_name,
    l.set_name,
    l.card_image_url
  into v_lowest, v_average, v_highest, v_count, v_card_name, v_set_name, v_image_url
  from public.listings l
  join public.merchant_profiles mp on mp.id = l.merchant_id
  where l.card_id = p_card_id
    and l.status  = 'active'
    and l.seller_type = 'certified_merchant'
    and mp.status = 'active'
  group by l.card_name, l.set_name, l.card_image_url
  limit 1;

  if v_count is null or v_count = 0 then
    -- 沒有認證商家有貨，刪除或清空記錄
    delete from public.hk_market_prices where card_id = p_card_id;
    return;
  end if;

  -- 找最低價的商家
  select l.merchant_id, mp.shop_name_zh, mp.district
  into v_merchant_id, v_merchant_name, v_district
  from public.listings l
  join public.merchant_profiles mp on mp.id = l.merchant_id
  where l.card_id     = p_card_id
    and l.status      = 'active'
    and l.seller_type = 'certified_merchant'
    and mp.status     = 'active'
    and l.price       = v_lowest
  order by l.created_at
  limit 1;

  -- Upsert hk_market_prices
  insert into public.hk_market_prices (
    card_id, card_name, set_name, card_image_url,
    lowest_price, average_price, highest_price,
    lowest_price_merchant_id, lowest_price_merchant_name, lowest_price_district,
    merchant_count, recorded_at
  ) values (
    p_card_id, v_card_name, v_set_name, v_image_url,
    v_lowest, round(v_average, 0), v_highest,
    v_merchant_id, v_merchant_name, v_district,
    v_count, now()
  )
  on conflict (card_id) do update set
    lowest_price               = excluded.lowest_price,
    average_price              = excluded.average_price,
    highest_price              = excluded.highest_price,
    lowest_price_merchant_id   = excluded.lowest_price_merchant_id,
    lowest_price_merchant_name = excluded.lowest_price_merchant_name,
    lowest_price_district      = excluded.lowest_price_district,
    merchant_count             = excluded.merchant_count,
    recorded_at                = excluded.recorded_at;

  -- 同時寫入歷史記錄
  insert into public.hk_price_history (card_id, card_name, avg_price, low_price, high_price, date)
  values (p_card_id, v_card_name, round(v_average, 0), v_lowest, v_highest, current_date)
  on conflict (card_id, date) do update set
    avg_price  = excluded.avg_price,
    low_price  = excluded.low_price,
    high_price = excluded.high_price;
end;
$$;

-- Trigger：listing 變動時自動重算 HK 市場價
create or replace function public.trigger_refresh_hk_price()
returns trigger language plpgsql security definer as $$
declare
  target_card_id text;
begin
  -- 取得受影響的 card_id
  if tg_op = 'DELETE' then
    target_card_id := old.card_id;
  else
    target_card_id := new.card_id;
  end if;

  -- 只處理認證商家的 listing
  if (tg_op != 'DELETE' and new.seller_type = 'certified_merchant') or
     (tg_op  = 'DELETE' and old.seller_type = 'certified_merchant') then
    perform public.refresh_hk_market_price(target_card_id);
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists listings_refresh_hk_price on public.listings;
create trigger listings_refresh_hk_price
  after insert or update or delete on public.listings
  for each row execute function public.trigger_refresh_hk_price();
