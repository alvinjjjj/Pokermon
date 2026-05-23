-- Allow authenticated users to upsert booster_box_prices
-- (prices are public market data, not user-private)
drop policy if exists "service role can upsert box prices" on public.booster_box_prices;

create policy "authenticated can upsert box prices"
  on public.booster_box_prices for all
  using (auth.role() = 'authenticated' or auth.role() = 'service_role')
  with check (auth.role() = 'authenticated' or auth.role() = 'service_role');
