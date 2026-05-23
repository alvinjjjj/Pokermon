-- ============================================================
-- QA 確保所有必需欄位存在（冪等，可安全重複執行）
-- 在 Supabase SQL Editor 執行此腳本
-- ============================================================

-- ── profiles ──────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio             text,
  ADD COLUMN IF NOT EXISTS portfolio_name  text NOT NULL DEFAULT 'Main',
  ADD COLUMN IF NOT EXISTS tos_agreed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS display_name    text,
  ADD COLUMN IF NOT EXISTS display_currency text NOT NULL DEFAULT 'HKD';

-- ── posts ─────────────────────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS post_category text NOT NULL DEFAULT 'post'
    CHECK (post_category IN ('post', 'unboxing'));

-- 所有已存在帖子設為 approved
UPDATE public.posts
  SET moderation_status = 'approved'
  WHERE moderation_status = 'pending';

-- ── posts: likes_count + comments_count ───────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS likes_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

-- ── post_comments（如未建）──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS post_comments_user_idx ON public.post_comments(user_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments read"         ON public.post_comments;
DROP POLICY IF EXISTS "comments owner write"  ON public.post_comments;
DROP POLICY IF EXISTS "comments owner delete" ON public.post_comments;
CREATE POLICY "comments read"         ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "comments owner write"  ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments owner delete" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

-- ── notifications（如未建）──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type        text        NOT NULL,
  post_id     uuid        REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id  uuid        REFERENCES public.post_comments(id) ON DELETE CASCADE,
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx    ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx  ON public.notifications(user_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications read own"   ON public.notifications;
DROP POLICY IF EXISTS "notifications update own" ON public.notifications;
DROP POLICY IF EXISTS "notifications insert"     ON public.notifications;
CREATE POLICY "notifications read own"   ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications insert"     ON public.notifications FOR INSERT WITH CHECK (true);

-- ── notifications type constraint ────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'moderation_approved', 'moderation_rejected'));

-- ── post_likes（如未建）──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes read" ON public.post_likes;
CREATE POLICY "likes read" ON public.post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "likes write own" ON public.post_likes;
CREATE POLICY "likes write own" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes delete own" ON public.post_likes;
CREATE POLICY "likes delete own" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- ── follows（如未建）────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows read" ON public.follows;
CREATE POLICY "follows read" ON public.follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "follows write own" ON public.follows;
CREATE POLICY "follows write own" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "follows delete own" ON public.follows;
CREATE POLICY "follows delete own" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- ── post_reports（如未建）───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports insert own" ON public.post_reports;
CREATE POLICY "reports insert own" ON public.post_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ── 自動同步 comments_count ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comments_count ON public.post_comments;
CREATE TRIGGER trg_comments_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_comments_count();

-- ── 自動建立讚好通知 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_post_owner uuid;
BEGIN
  SELECT user_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  IF v_post_owner IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id)
    VALUES (v_post_owner, NEW.user_id, 'like', NEW.post_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_like ON public.post_likes;
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- ── 自動建立留言通知 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_post_owner uuid;
BEGIN
  SELECT user_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  IF v_post_owner IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id, comment_id)
    VALUES (v_post_owner, NEW.user_id, 'comment', NEW.post_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment ON public.post_comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- ── 自動建立關注通知 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications(user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ── 自動建立審核通知 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.moderation_status = NEW.moderation_status THEN RETURN NEW; END IF;
  IF NEW.moderation_status = 'approved' THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id)
    VALUES (NEW.user_id, NULL, 'moderation_approved', NEW.id);
  ELSIF NEW.moderation_status = 'rejected' THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id)
    VALUES (NEW.user_id, NULL, 'moderation_rejected', NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_moderation ON public.posts;
CREATE TRIGGER trg_notify_moderation
  AFTER UPDATE OF moderation_status ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_moderation();

-- ── 驗證 ─────────────────────────────────────────────────────
SELECT
  column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('bio', 'tos_agreed_at', 'portfolio_name', 'display_currency')
ORDER BY column_name;
