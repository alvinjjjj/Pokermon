-- Add box support to user_collection
-- item_type: 'card' (default) | 'box'
-- box_condition: 'Sealed' | 'Opened' (only for boxes)

alter table public.user_collection
  add column if not exists item_type    text not null default 'card',
  add column if not exists box_condition text;

-- Optional: add a check constraint
alter table public.user_collection
  add constraint item_type_check
    check (item_type in ('card', 'box'));

alter table public.user_collection
  add constraint box_condition_check
    check (box_condition is null or box_condition in ('Sealed', 'Opened'));
