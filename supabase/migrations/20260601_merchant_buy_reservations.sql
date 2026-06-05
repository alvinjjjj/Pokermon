-- Phase B.4 · Merchant buy reservations (kaitori inquiry tracking)
--
-- Each row: one buyer's intent-to-sell to a specific buy_order.
-- "我有呢張卡" lock · merchant has 24hr to honor/reject.
--
-- Auto-trigger: on insert, increment merchant_buy_orders.daily_filled.
-- App-layer handles expiry display (no cron needed for MVP).

create table if not exists public.merchant_buy_reservations (
  id              uuid primary key default gen_random_uuid(),
  buy_order_id    uuid not null references public.merchant_buy_orders(id) on delete cascade,
  buyer_id        uuid references auth.users(id) on delete set null,
  merchant_id     uuid references auth.users(id) on delete set null,

  -- Denormalized snapshot at reservation time
  card_id         text not null,
  card_name       text not null,
  reserved_price  numeric(12,2) not null check (reserved_price >= 0),
  conditions      text[] not null,

  -- Lifecycle
  status          text not null default 'pending'
                    check (status in ('pending','honored','rejected','expired','cancelled')),
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  honored_at      timestamptz,
  rejected_at     timestamptz,
  rejection_reason text,
  buyer_note      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_mbr_buyer
  on public.merchant_buy_reservations(buyer_id, status);
create index if not exists idx_mbr_merchant_pending
  on public.merchant_buy_reservations(merchant_id, status)
  where status = 'pending';
create index if not exists idx_mbr_buy_order
  on public.merchant_buy_reservations(buy_order_id);

-- RLS
alter table public.merchant_buy_reservations enable row level security;

create policy "reservations readable by participants"
  on public.merchant_buy_reservations for select
  using (auth.uid() = buyer_id or auth.uid() = merchant_id);

create policy "authenticated users insert own reservations"
  on public.merchant_buy_reservations for insert
  with check (auth.uid() = buyer_id);

create policy "merchant updates own reservations status"
  on public.merchant_buy_reservations for update
  using (auth.uid() = merchant_id);

create policy "buyer cancels own pending reservations"
  on public.merchant_buy_reservations for update
  using (auth.uid() = buyer_id and status = 'pending');

-- Trigger: on insert, increment daily_filled on the buy_order
create or replace function increment_buy_order_filled() returns trigger as $$
begin
  update public.merchant_buy_orders
  set daily_filled = daily_filled + 1,
      last_filled_at = now(),
      updated_at = now()
  where id = new.buy_order_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_increment_buy_order_filled on public.merchant_buy_reservations;
create trigger tg_increment_buy_order_filled
  after insert on public.merchant_buy_reservations
  for each row
  execute function increment_buy_order_filled();

-- Trigger: auto-update updated_at
create or replace function update_reservation_timestamp() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_touch_reservation_updated_at on public.merchant_buy_reservations;
create trigger tg_touch_reservation_updated_at
  before update on public.merchant_buy_reservations
  for each row
  execute function update_reservation_timestamp();

comment on table public.merchant_buy_reservations is
  'Phase B.4. Buyer "我有呢張" lock against a merchant buy order. 24hr expiry. Auto-increments daily_filled on insert via trigger.';
