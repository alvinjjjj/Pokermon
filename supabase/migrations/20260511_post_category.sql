-- 加入帖子分類：帖子 / 卡片開箱
alter table public.posts
  add column if not exists post_category text
    not null default 'post'
    check (post_category in ('post', 'unboxing'));

create index if not exists posts_category_idx
  on public.posts(post_category, created_at desc);
