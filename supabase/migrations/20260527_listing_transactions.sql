-- listing_transactions: capture actual close price + sold timestamp for every sale.
--
-- Phase 2 (launch + 2m) data attribution depends on this. Without it, post-
-- launch HK market signals — "last sold price", "30-day sales volume",
-- "sold-price trend" — have 0 records to compute against even if the rail-
-- switch ships on schedule. Must populate from Day 1.
--
-- Design notes
--   • Card identity (card_id, card_name, set_name) is DENORMALIZED. Survives
--     deletion of related card rows or listings; aggregate queries can run
--     on this table alone.
--   • seller_id is NULLABLE despite every row having a seller at insert
--     time. Rationale: historical transaction records must survive user
--     account deletion (anonymised). `on delete set null` requires the
--     column to be nullable — `not null + set null` would violate the
--     constraint at delete time. (Deviates from user prompt; chose data
--     preservation over schema strictness.)
--   • buyer_id likewise nullable — most early sales will be off-platform
--     (WhatsApp), buyer unknown to us.
--   • asking_price + sold_price are STORED SEPARATELY so we can compute
--     the bargain delta (sold/asking ratio) — a real market signal beyond
--     just "what closed". A 0.85 ratio over many sales means listed prices
--     run ~18% above actual close, useful for the HK-data switch.

create table if not exists public.listing_transactions (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings(id) on delete cascade,

  -- Card identity (denormalized — survives card_id / listing row deletion)
  card_id         text not null,
  card_name       text not null,
  set_name        text,

  -- Parties (nullable to outlive user account deletion; see note above)
  seller_id       uuid references auth.users(id) on delete set null,
  buyer_id        uuid references auth.users(id) on delete set null,
  seller_type     text not null
                    check (seller_type in ('certified_merchant','individual_seller')),

  -- Price signals
  asking_price    numeric(12,2) not null check (asking_price >= 0),
  sold_price      numeric(12,2) not null check (sold_price >= 0),
  condition       text,

  -- Timing + channel
  sold_at         timestamptz not null default now(),
  sold_via        text not null default 'off_platform'
                    check (sold_via in ('on_platform','off_platform')),

  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_listing_tx_card_sold
  on public.listing_transactions(card_id, sold_at desc);
create index if not exists idx_listing_tx_seller
  on public.listing_transactions(seller_id);

-- RLS
alter table public.listing_transactions enable row level security;

-- Public read: aggregate market signals are non-PII; individual rows can
-- expose `notes` and identities, so consumers should query aggregates only.
-- Future hardening: tighten this policy once HK market signals are served
-- by views or RPCs and the raw table can be locked down.
create policy "transactions readable by all"
  on public.listing_transactions for select
  using (true);

-- Seller inserts own
create policy "seller inserts own transactions"
  on public.listing_transactions for insert
  with check (auth.uid() = seller_id);

-- Seller updates own (e.g. correct sold_price post-sale)
create policy "seller updates own transactions"
  on public.listing_transactions for update
  using (auth.uid() = seller_id);

comment on table public.listing_transactions is
  'Records actual close prices for every listing sale. Powers Phase 2 '
  '(launch+2m) HK market signals: last sold price, sold-price trend, '
  '30-day sales volume. Without Day-1 population, post-launch attribution '
  'starts from 0 — the table must exist and accept inserts before launch.';
