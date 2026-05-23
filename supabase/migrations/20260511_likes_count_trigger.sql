-- #79: likes_count sync trigger
-- Keeps posts.likes_count in sync automatically via DB trigger
-- Prevents count drift from missed app-level updates

CREATE OR REPLACE FUNCTION public.sync_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_likes_count ON public.post_likes;

CREATE TRIGGER trg_sync_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_likes_count();

-- Backfill existing counts (fix any drift that already exists)
UPDATE public.posts p
SET likes_count = (
  SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id
);
