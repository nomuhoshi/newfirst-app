-- 访问实测用的一张小表。在 Supabase 后台 SQL 编辑器里粘贴并运行。
-- 前提：Authentication → Sign In / Providers → 打开 "Allow anonymous sign-ins"。
-- 每个测试用户只能读写自己那一行。测完可以整张删掉：drop table public.access_test;
create table if not exists public.access_test (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text not null,
  updated_at timestamptz not null default now()
);
alter table public.access_test enable row level security;

drop policy if exists "只读自己的行" on public.access_test;
drop policy if exists "只写自己的行" on public.access_test;
drop policy if exists "只改自己的行" on public.access_test;
create policy "只读自己的行" on public.access_test for select to authenticated using (auth.uid() = user_id);
create policy "只写自己的行" on public.access_test for insert to authenticated with check (auth.uid() = user_id);
create policy "只改自己的行" on public.access_test for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
