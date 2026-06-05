-- Phase B.1 · Merchant buy orders (Kaitori) — 認證商戶買取
--
-- Each row: one buy offer from a certified merchant for a specific card.
-- User-facing intent: "我今日想收 X 張呢張卡，每張 HK$Y"
--
-- Hard constraints:
--   1. Max 10 active orders per merchant (DB trigger enforced)
--   2. Only certified_merchant role can insert (RLS policy)
--   3. Public read of active orders (for card detail page display)
--   4. Today-only expiry (midnight HKT reset) — daily_filled counter resets via app-layer logic
--
-- Phase B.4 will add merchant_buy_reservations table for "我有呢張" inquiry tracking.

create table if not exists public.merchant_buy_orders (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references auth.users(id) on delete cascade,

  -- Card identity (denormalized · survives card row deletion)
  card_id         text not null,
  card_name       text not null,
  set_name        text,

  -- Buy terms
  buy_price       numeric(12,2) not null check (buy_price >= 0),
  conditions      text[] not null default array['PSA 10']
                    check (cardinality(conditions) > 0),
  languages       text[] not null default array['EN']
                    check (cardinality(languages) > 0),

  -- Daily quota
  daily_limit     int not null default 1
                    check (daily_limit > 0 and daily_limit <= 100),
  daily_filled    int not null default 0
                    check (daily_filled >= 0),
  last_filled_at  timestamptz,

  -- Today-only expiry · midnight HKT next day
  expires_at      timestamptz not null default
                    ((date_trunc('day', (now() at time zone 'Asia/Hong_Kong'))
                      + interval '1 day') at time zone 'Asia/Hong_Kong'),
  reset_at        timestamptz not null default
                    ((date_trunc('day', (now() at time zone 'Asia/Hong_Kong'))
                      + interval '1 day') at time zone 'Asia/Hong_Kong'),

  -- Status lifecycle
  status          text not null default 'active'
                    check (status in ('active','paused','expired','cancelled')),

  -- Optional
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_mbo_card_active
  on public.merchant_buy_orders(card_id, status)
  where status = 'active';
create index if not exists idx_mbo_merchant
  on public.merchant_buy_orders(merchant_id, status);
create index if not exists idx_mbo_expiry
  on public.merchant_buy_orders(status, expires_at)
  where status = 'active';

-- RLS
alter table public.merchant_buy_orders enable row level security;

create policy "buy orders readable by all"
  on public.merchant_buy_orders for select
  using (status = 'active');

create policy "certified merchants insert own buy orders"
  on public.merchant_buy_orders for insert
  with check (
    auth.uid() = merchant_id
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role in ('certified_merchant','admin','super_admin')
    )
  );

create policy "merchant updates own buy orders"
  on public.merchant_buy_orders for update
  using (auth.uid() = merchant_id);

create policy "merchant deletes own buy orders"
  on public.merchant_buy_orders for delete
  using (auth.uid() = merchant_id);

-- Trigger: enforce max 10 active orders per merchant
create or replace function check_merchant_buy_order_limit() returns trigger as $$
begin
  if new.status = 'active' then
    if (select count(*) from public.merchant_buy_orders
        where merchant_id = new.merchant_id
        and status = 'active'
        and id != new.id) >= 10 then
      raise exception 'Merchant cannot have more than 10 active buy orders';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_buy_order_limit on public.merchant_buy_orders;
create trigger enforce_buy_order_limit
  before insert or update on public.merchant_buy_orders
  for each row
  execute function check_merchant_buy_order_limit();

-- Trigger: auto-update updated_at
create or replace function update_buy_order_timestamp() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_buy_order_updated_at on public.merchant_buy_orders;
create trigger touch_buy_order_updated_at
  before update on public.merchant_buy_orders
  for each row
  execute function update_buy_order_timestamp();

comment on table public.merchant_buy_orders is
  'Phase B (Kaitori 認證商戶買取). Each row = one buy offer from certified merchant. Max 10 active per merchant. Today-only expiry. RLS: public read active, certified_merchant role required to insert.';
