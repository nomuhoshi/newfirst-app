-- 账号隔离 + 并发保护验证。本地：psql -f stub.sql -f ../schema.sql -f isolation.sql；Supabase 后台也可运行（会回滚，不留数据）。
-- 以 postgres（超级用户）身份建两个测试用户；然后切到 authenticated 角色并用 request.jwt.claim.sub 模拟登录。
begin;
create temp table t(a uuid, b uuid);
insert into t select gen_random_uuid(), gen_random_uuid();
insert into auth.users(id, email) select a, 'a@test' from t;
insert into auth.users(id, email) select b, 'b@test' from t;
grant select on t to authenticated, anon;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); end $$;
create or replace function pg_temp.ok(name text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice 'PASS  %', name; else raise exception 'FAIL  %', name; end if; end $$;

-- 1) 未登录（anon）不能读也不能写
set local role anon;
do $$ declare e text; begin
  begin perform count(*) from public.progress; e := 'read-allowed'; exception when insufficient_privilege then e := 'denied'; end;
  perform pg_temp.ok('anon 不能读表', e = 'denied');
  begin perform public.create_progress('{}'::jsonb); e := 'allowed'; exception when insufficient_privilege then e := 'denied'; end;
  perform pg_temp.ok('anon 不能调用 create_progress', e = 'denied');
  begin perform public.save_progress(1, '{}'::jsonb); e := 'allowed'; exception when insufficient_privilege then e := 'denied'; end;
  perform pg_temp.ok('anon 不能调用 save_progress', e = 'denied');
  begin perform public.delete_my_account(); e := 'allowed'; exception when insufficient_privilege then e := 'denied'; end;
  perform pg_temp.ok('anon 不能调用 delete_my_account', e = 'denied');
end $$;
reset role;

-- 2) 已登录但 uid 为空（无效令牌）：函数拒绝
set local role authenticated;
select pg_temp.as_user(null);
do $$ declare e text; begin
  begin perform public.create_progress('{}'::jsonb); e := 'allowed'; exception when sqlstate '28000' then e := 'denied'; end;
  perform pg_temp.ok('uid 为空时 create_progress 被拒绝', e = 'denied');
end $$;

-- 3) A 创建与保存
select pg_temp.as_user((select a from t));
do $$ declare r integer; begin
  r := public.create_progress('{"xp":{"d1":10}}'::jsonb);
  perform pg_temp.ok('A 首次创建 → rev 1', r = 1);
  r := public.create_progress('{"xp":{"d1":999}}'::jsonb);
  perform pg_temp.ok('A 重复创建不覆盖（返回 null）', r is null and (select (doc->'xp'->>'d1')::int from public.progress) = 10);
  r := public.save_progress(1, '{"xp":{"d1":20}}'::jsonb);
  perform pg_temp.ok('A 带正确版本保存 → rev 2', r = 2);
  r := public.save_progress(1, '{"xp":{"d1":30}}'::jsonb);
  perform pg_temp.ok('A 用过期版本保存 → null，内容不变', r is null and (select (doc->'xp'->>'d1')::int from public.progress) = 20);
end $$;

-- 4) 直接写表不能绕过版本检查（A 自己也不行）
do $$ declare e text; begin
  begin update public.progress set doc = '{"xp":{"d1":1}}'::jsonb; e := 'allowed'; exception when insufficient_privilege then e := 'denied'; end;
  perform pg_temp.ok('A 直接 UPDATE 表被拒绝', e = 'denied');
  begin insert into public.progress(user_id, doc) values ((select a from t), '{}'::jsonb); e := 'allowed'; exception when insufficient_privilege then e := 'denied'; end;
  perform pg_temp.ok('A 直接 INSERT 表被拒绝', e = 'denied');
  begin delete from public.progress; e := 'allowed'; exception when insufficient_privilege then e := 'denied'; end;
  perform pg_temp.ok('A 直接 DELETE 表被拒绝', e = 'denied');
end $$;

-- 5) B 看不到、改不了 A
select pg_temp.as_user((select b from t));
do $$ declare r integer; e text; begin
  perform pg_temp.ok('B 读表看不到 A 的行', (select count(*) from public.progress) = 0);
  r := public.save_progress(2, '{"xp":{"d1":0}}'::jsonb);
  perform pg_temp.ok('B 用 A 的 rev 调用 save_progress 改不到 A（B 没有行 → null）', r is null);
  begin update public.progress set doc = '{}'::jsonb; e := 'allowed'; exception when insufficient_privilege then e := 'denied'; end;
  perform pg_temp.ok('B 直接 UPDATE 被拒绝', e = 'denied');
  r := public.create_progress('{"xp":{"d2":5}}'::jsonb);
  perform pg_temp.ok('B 创建自己的行 → rev 1', r = 1 and (select count(*) from public.progress) = 1);
end $$;

-- 6) 删除账号只删本人（B 删自己；A 的数据仍在）
do $$ begin perform public.delete_my_account(); end $$;
reset role;
do $$ begin
  perform pg_temp.ok('B 删除后 B 的进度行没了', (select count(*) from public.progress where user_id = (select b from t)) = 0);
  perform pg_temp.ok('B 的账号没了，A 的账号和进度还在', (select count(*) from auth.users where id = (select b from t)) = 0
    and (select count(*) from auth.users where id = (select a from t)) = 1
    and (select count(*) from public.progress where user_id = (select a from t)) = 1);
end $$;
rollback;
