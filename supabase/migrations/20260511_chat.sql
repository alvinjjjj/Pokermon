-- ─────────────────────────────────────────────────────────────
-- Chat: conversations + messages
-- ─────────────────────────────────────────────────────────────

-- Conversations
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  buyer_id        uuid references auth.users(id) on delete cascade not null,
  seller_id       uuid references auth.users(id) on delete cascade not null,
  listing_id      uuid references public.listings(id) on delete set null,
  merchant_id     uuid references public.merchant_profiles(id) on delete set null,
  last_message    text,
  last_message_at timestamptz,
  unread_buyer    int  default 0 not null,
  unread_seller   int  default 0 not null,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

-- Unique conversation per buyer+seller+listing (null-safe)
create unique index conversations_unique_idx
  on public.conversations (buyer_id, seller_id, coalesce(listing_id::text, ''));

create index conversations_buyer_idx  on public.conversations (buyer_id,  updated_at desc);
create index conversations_seller_idx on public.conversations (seller_id, updated_at desc);

-- Messages
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id       uuid references auth.users(id) on delete cascade not null,
  content         text not null check (char_length(trim(content)) > 0),
  is_read         boolean default false not null,
  created_at      timestamptz default now() not null
);

create index messages_conv_idx on public.messages (conversation_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- Conversations: both parties can view
create policy "conv_select" on public.conversations
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Conversations: only buyer creates
create policy "conv_insert" on public.conversations
  for insert with check (auth.uid() = buyer_id);

-- Conversations: both parties can update (unread counters etc.)
create policy "conv_update" on public.conversations
  for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Messages: participants can read
create policy "msg_select" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Messages: participants can send (must be the sender)
create policy "msg_insert" on public.messages
  for insert with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Messages: recipient can mark as read
create policy "msg_update_read" on public.messages
  for update using (
    sender_id <> auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- ── Trigger: update conversation on new message ───────────────

create or replace function public.handle_new_message()
returns trigger language plpgsql security definer as $$
begin
  update public.conversations
  set
    last_message    = new.content,
    last_message_at = new.created_at,
    updated_at      = new.created_at,
    -- increment unread for the RECIPIENT
    unread_buyer    = case when seller_id = new.sender_id then unread_buyer  + 1 else unread_buyer  end,
    unread_seller   = case when buyer_id  = new.sender_id then unread_seller + 1 else unread_seller end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- ── Realtime ──────────────────────────────────────────────────

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
