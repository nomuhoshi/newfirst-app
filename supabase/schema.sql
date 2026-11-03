-- 碎片编程：账号进度表（docs/15-account-sync-plan.md §4）。在 Supabase 后台 SQL 编辑器粘贴并运行。
-- 设计：**表只读，写入只能走两个受控函数**（首次创建 / 带版本检查的保存）。这样版本检查（CAS）无法被"直接更新表"绕过。
--   账号隔离靠两层：行级权限（只能读自己的行）+ 函数里一律用 auth.uid()（不接受调用方传 user_id）。
-- 可重复运行（幂等）。注意：本脚本会收回 anon / authenticated 对表的写权限。
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null,
  rev integer not null default 1 check (rev >= 1),
  updated_at timestamptz not null default now(),
  constraint doc_is_object check (jsonb_typeof(doc) = 'object'),
  constraint doc_not_huge check (pg_column_size(doc) < 65536)
);
alter table public.progress enable row level security;
alter table public.progress force row level security;

-- 表权限：先全部收回，再只给已登录用户"读"。anon（未登录）什么都没有。
revoke all on table public.progress from public, anon, authenticated;
grant select on table public.progress to authenticated;

drop policy if exists "只读自己的进度" on public.progress;
drop policy if exists "只新建自己的进度" on public.progress;
drop policy if exists "只改自己的进度" on public.progress;
create policy "只读自己的进度" on public.progress for select to authenticated using (auth.uid() = user_id);
-- 故意没有 insert / update / delete 策略，也没有这些权限：直接写表会被拒绝（permission denied）。

-- 首次创建：已有就什么都不做，返回 null（调用方改走 save_progress）；成功返回 1。
create or replace function public.create_progress(new_doc jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r integer;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into public.progress (user_id, doc, rev) values (auth.uid(), new_doc, 1)
    on conflict (user_id) do nothing returning rev into r;
  return r;
end $$;

-- 带版本检查的保存：只有 rev 等于调用方读到的 expected_rev 才写入，成功后 rev + 1 并返回新 rev；
-- 被抢先（rev 已变）或没有这一行 → 返回 null（调用方重新读、合并、再写）。单条 UPDATE 在行锁下执行，并发时只有一个能成功。
create or replace function public.save_progress(expected_rev integer, new_doc jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r integer;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.progress set doc = new_doc, rev = rev + 1, updated_at = now()
   where user_id = auth.uid() and rev = expected_rev
   returning rev into r;
  return r;
end $$;

-- 删除自己的账号（进度表跟着 auth.users 一起级联删除）。只能删自己。
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.create_progress(jsonb) from public, anon, authenticated;
revoke all on function public.save_progress(integer, jsonb) from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.create_progress(jsonb) to authenticated;
grant execute on function public.save_progress(integer, jsonb) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
