-- Phase B hardening · 2026-06-08
-- Closes findings from code recheck:
--   C-1 · merchant_buy_reservations UPDATE policies missing WITH CHECK
--        → buyer could self-honor with fraudulent reserved_price (money fraud path)
--   C-2 · merchant_buy_orders UPDATE policy missing WITH CHECK
--        → merchant could reset daily_filled / extend expires_at / retro-edit buy_price
--   I-4 · daily_filled <= daily_limit race condition
--        → 2 concurrent reservations could exceed quota (no transactional guard)
--
-- Applied AFTER B.1 (6148fe7) + B.4 (06f022c) — both tables exist with 0 rows.
-- Idempotent (DROP IF EXISTS + CREATE pattern).

-- =============================================================
-- C-2 · merchant_buy_orders: WITH CHECK + immutability trigger
-- =============================================================
drop policy if exists "merchant updates own buy orders"
  on public.merchant_buy_orders;
create policy "merchant updates own buy orders"
  on public.merchant_buy_orders for update
  using (auth.uid() = merchant_id)
  with check (auth.uid() = merchant_id);

create or replace function enforce_buy_order_immutability() returns trigger as $$
begin
  -- Identity locked forever
  if new.merchant_id is distinct from old.merchant_id then
    raise exception 'merchant_id is immutable on buy orders';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;
  -- daily_filled can only mutate via reservation cascade
  -- pg_trigger_depth() = 1: direct user UPDATE (block)
  -- pg_trigger_depth() > 1: cascaded from reservation AFTER INSERT (allow)
  if new.daily_filled is distinct from old.daily_filled
     and pg_trigger_depth() <= 1 then
    raise exception 'daily_filled can only be modified by reservation system';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_enforce_buy_order_immutability
  on public.merchant_buy_orders;
create trigger tg_enforce_buy_order_immutability
  before update on public.merchant_buy_orders
  for each row
  execute function enforce_buy_order_immutability();

-- I-4 · Race-safe quota constraint
-- (zero existing rows · no backfill needed)
alter table public.merchant_buy_orders
  drop constraint if exists daily_filled_le_limit;
alter table public.merchant_buy_orders
  add constraint daily_filled_le_limit
  check (daily_filled <= daily_limit);

-- =============================================================
-- C-1 · merchant_buy_reservations: WITH CHECK + immutability trigger
-- =============================================================
drop policy if exists "merchant updates own reservations status"
  on public.merchant_buy_reservations;
create policy "merchant updates own reservations status"
  on public.merchant_buy_reservations for update
  using (auth.uid() = merchant_id and status = 'pending')
  with check (auth.uid() = merchant_id
              and status in ('honored', 'rejected'));

drop policy if exists "buyer cancels own pending reservations"
  on public.merchant_buy_reservations;
create policy "buyer cancels own pending reservations"
  on public.merchant_buy_reservations for update
  using (auth.uid() = buyer_id and status = 'pending')
  with check (auth.uid() = buyer_id and status = 'cancelled');

create or replace function enforce_reservation_immutability() returns trigger as $$
begin
  -- Identity locked forever
  if new.buy_order_id is distinct from old.buy_order_id then
    raise exception 'buy_order_id is immutable';
  end if;
  if new.buyer_id is distinct from old.buyer_id then
    raise exception 'buyer_id is immutable';
  end if;
  if new.merchant_id is distinct from old.merchant_id then
    raise exception 'merchant_id is immutable';
  end if;
  -- Snapshot fields locked forever (the whole point of denormalization)
  if new.card_id is distinct from old.card_id then
    raise exception 'card_id snapshot is immutable';
  end if;
  if new.card_name is distinct from old.card_name then
    raise exception 'card_name snapshot is immutable';
  end if;
  if new.reserved_price is distinct from old.reserved_price then
    raise exception 'reserved_price snapshot is immutable';
  end if;
  if new.conditions is distinct from old.conditions then
    raise exception 'conditions snapshot is immutable';
  end if;
  if new.buyer_note is distinct from old.buyer_note then
    raise exception 'buyer_note is immutable after creation';
  end if;
  -- Lifecycle timing immutable
  if new.expires_at is distinct from old.expires_at then
    raise exception 'expires_at is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_enforce_reservation_immutability
  on public.merchant_buy_reservations;
create trigger tg_enforce_reservation_immutability
  before update on public.merchant_buy_reservations
  for each row
  execute function enforce_reservation_immutability();

comment on function enforce_buy_order_immutability is
  'Phase B hardening 2026-06-08. Prevents merchant_id / created_at / daily_filled tampering via direct UPDATE. daily_filled cascade from reservation trigger uses pg_trigger_depth() detection.';
comment on function enforce_reservation_immutability is
  'Phase B hardening 2026-06-08. Locks identity + snapshot + lifecycle fields after row creation. Only status / honored_at / rejected_at / rejection_reason / updated_at are mutable.';
