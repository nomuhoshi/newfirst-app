-- 碎片编程：账号进度表（docs/15-account-sync-plan.md §4）。在 Supabase 后台 SQL 编辑器粘贴并运行。
-- 只用公开（publishable / anon）密钥访问；每个人只能读写 user_id = 自己的那一行（行级权限）。
-- 可重复运行（幂等）。
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null,
  rev integer not null default 1 check (rev >= 1),
  updated_at timestamptz not null default now(),
  constraint doc_is_object check (jsonb_typeof(doc) = 'object'),
  constraint doc_not_huge check (pg_column_size(doc) < 65536)
);
alter table public.progress enable row level security;

drop policy if exists "只读自己的进度" on public.progress;
drop policy if exists "只新建自己的进度" on public.progress;
drop policy if exists "只改自己的进度" on public.progress;
create policy "只读自己的进度" on public.progress for select to authenticated using (auth.uid() = user_id);
create policy "只新建自己的进度" on public.progress for insert to authenticated with check (auth.uid() = user_id and rev = 1);
create policy "只改自己的进度" on public.progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- 没有 delete 策略：普通用户不能直接删行；删除账号走下面的函数。

-- 乐观并发：只有 rev 等于调用方读到的版本才写入，成功后 rev + 1；返回新 rev，被抢先则返回 null（调用方重新读、合并、再写）。
create or replace function public.save_progress(expected_rev integer, new_doc jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare r integer;
begin
  update public.progress set doc = new_doc, rev = rev + 1, updated_at = now()
   where user_id = auth.uid() and rev = expected_rev
   returning rev into r;
  return r;
end $$;

-- 删除自己的账号（进度表跟着 auth.users 一起级联删除）。只能删自己。
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.save_progress(integer, jsonb) from public, anon;
grant execute on function public.save_progress(integer, jsonb) to authenticated;

-- 账号隔离自检（在 SQL 编辑器里用 "run as authenticated" 的两个测试用户各跑一遍，见 docs/supabase-setup.md §5）：
--   select count(*) from public.progress;   -- 每个用户只应看到自己那一行（0 或 1）
