-- ─────────────────────────────────────────────────────────────
-- Security fixes round 2 — 2026-05-13
--
-- Run AFTER 20260513_security_fixes.sql. Idempotent.
--
-- Addresses three holes found in code review:
--   1. notifications INSERT policy still allowed spoofed rows
--   2. messages UPDATE allowed recipient to rewrite content
--   3. messages_content_check used non-trim length for the upper bound
-- ─────────────────────────────────────────────────────────────


-- ── 1. notifications: remove client INSERT policy entirely ────
--
-- Today's earlier fix tightened the policy to `actor_id = auth.uid()`, but
-- every legitimate notification is created by a SECURITY DEFINER trigger
-- (notify_on_like / notify_on_comment / notify_on_follow / notify_on_moderation)
-- which bypasses RLS. The client policy therefore only adds a spoofing
-- surface ("user X inserts a fake row claiming actor_id = self, user_id =
-- victim → victim's inbox shows a fake notification").
--
-- Drop the policy. Triggers continue to work because SECURITY DEFINER
-- ignores RLS entirely.

drop policy if exists "notifications_insert"       on public.notifications;
drop policy if exists "notifications insert"       on public.notifications;
drop policy if exists "Allow authenticated insert" on public.notifications;


-- ── 2. messages: restrict recipient UPDATE to is_read only ────
--
-- The old "msg_update_read" policy let the recipient flip rows where
-- sender_id <> auth.uid(), but had no column restriction — meaning they
-- could also rewrite `content`, `created_at`, or `sender_id` on that row.
--
-- RLS can't enforce column-level grants, so we layer:
--   (a) tighten the RLS policy with a stricter WITH CHECK
--   (b) revoke broad UPDATE and grant only on is_read

drop policy if exists "msg_update_read" on public.messages;

create policy "msg_update_read"
  on public.messages
  for update
  using (
    sender_id <> auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  )
  with check (
    -- After the update: the row still belongs to the same sender + conversation.
    -- A malicious update that flips sender_id or conversation_id will fail here.
    sender_id <> auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Column-level grant: authenticated users can only UPDATE is_read.
-- Other columns remain unwritable even if a policy would otherwise permit it.
revoke update on public.messages from authenticated;
grant  update (is_read) on public.messages to authenticated;


-- ── 3. messages_content_check: use trimmed length for upper bound ──
--
-- Old: `char_length(trim(content)) > 0 and char_length(content) <= 2000`
-- Attacker could send 1999 spaces + payload. Use trimmed length both ways.

alter table public.messages
  drop constraint if exists messages_content_check;

alter table public.messages
  add  constraint messages_content_check
  check (char_length(trim(content)) between 1 and 2000);
