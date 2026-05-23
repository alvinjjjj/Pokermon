-- Cache table for booster box prices (refreshed every 3 days)
create table if not exists public.booster_box_prices (
  set_id        text primary key,        -- matches BoosterSet.id
  pack_usd      numeric(10,2) default 0, -- single pack market price
  box_usd       numeric(10,2) default 0, -- full box market price
  pack_new_usd  numeric(10,2) default 0, -- sealed/new price
  box_new_usd   numeric(10,2) default 0,
  source        text default 'manual',   -- 'pricecharting' | 'manual'
  updated_at    timestamptz default now()
);

-- Allow anyone to read (public price data)
alter table public.booster_box_prices enable row level security;
create policy "anyone can read box prices"
  on public.booster_box_prices for select using (true);

-- Only service role can update
create policy "service role can upsert box prices"
  on public.booster_box_prices for all using (auth.role() = 'service_role');
