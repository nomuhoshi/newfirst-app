-- 数据库权限复核 1：跨账号读写 + 身份校验 + 文档校验。本机临时 PostgreSQL，事务里跑完回滚，不留数据。
-- 用法：psql -f stub.sql -f schema.sql（建库后一次）；然后 psql -v ON_ERROR_STOP=1 -f review-1.sql
begin;
create temp table t(a uuid, b uuid, ghost uuid);
insert into t select gen_random_uuid(), gen_random_uuid(), gen_random_uuid();   -- ghost：从没有注册过 / 已被删除的账号
insert into auth.users(id, email) select a, 'a@test' from t;
insert into auth.users(id, email) select b, 'b@test' from t;
grant select on t to authenticated, anon;

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); end $$;
create function pg_temp.ok(name text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice 'PASS  %', name; else raise exception 'FAIL  %', name; end if; end $$;
-- 执行一条语句，返回 'ok' 或错误码（子事务，失败不影响外层）
create function pg_temp.try(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlstate; end $$;

-- ===== A. 跨账号 =====
set local role authenticated;
select pg_temp.as_user((select a from t));
select public.create_progress('{"owner":"A","xp":10}'::jsonb);
reset role;

set local role authenticated;
select pg_temp.as_user((select b from t));
do $$ declare r integer; a uuid := (select a from t); begin
  perform pg_temp.ok('A1 B 按 user_id 查 A 的行：0 行', (select count(*) from public.progress where user_id = a) = 0);
  perform pg_temp.ok('A2 B 查整张表：0 行（B 还没有自己的行）', (select count(*) from public.progress) = 0);
  r := public.save_progress(1, '{"owner":"B-hack"}'::jsonb);
  perform pg_temp.ok('A3 B 用 A 的 rev(=1) 调 save_progress → null（B 没有行，改不到 A）', r is null);
  perform pg_temp.ok('A4 直接 UPDATE A 的行被拒绝(42501)', pg_temp.try(format('update public.progress set doc = %L where user_id = %L', '{}', a)) = '42501');
  perform pg_temp.ok('A5 直接 DELETE 被拒绝', pg_temp.try(format('delete from public.progress where user_id = %L', a)) = '42501');
  perform pg_temp.ok('A6 直接 INSERT（冒充 A 的 user_id）被拒绝', pg_temp.try(format('insert into public.progress(user_id, doc) values (%L, %L)', a, '{}')) = '42501');
  perform pg_temp.ok('A7 upsert 冒充 A（insert … on conflict do update）被拒绝', pg_temp.try(format('insert into public.progress(user_id, doc) values (%L, %L) on conflict (user_id) do update set doc = excluded.doc', a, '{}')) = '42501');
  perform pg_temp.ok('A8 TRUNCATE 被拒绝', pg_temp.try('truncate public.progress') = '42501');
  perform pg_temp.ok('A10 不能读 auth.users（别人的邮箱）', pg_temp.try('select count(*) from auth.users') = '42501');
  perform pg_temp.ok('A11 不能改表结构 / 关闭行级安全', pg_temp.try('alter table public.progress disable row level security') = '42501');
  perform pg_temp.ok('A12 不能删除别人的账号以外的东西：delete from auth.users 直接执行被拒绝', pg_temp.try('delete from auth.users') = '42501');
  perform pg_temp.ok('A13 不能建函数顶替 create_progress / save_progress（public 里没有建对象的权限）', pg_temp.try('create function public.save_progress(integer, jsonb) returns integer language sql as $f$ select 1 $f$') = '42501');
  perform pg_temp.try('grant update, insert, delete on public.progress to authenticated');   -- 非属主授权：Postgres 只给警告、不会真的授予
  perform pg_temp.ok('A14 不能给自己加写权限（grant 之后 authenticated 仍然没有 INSERT/UPDATE/DELETE）', not has_table_privilege('authenticated', 'public.progress', 'update') and not has_table_privilege('authenticated', 'public.progress', 'insert') and not has_table_privilege('authenticated', 'public.progress', 'delete'));
end $$;
-- 临时表同名劫持：B 建一张临时表 progress，函数里写的都是 public.progress，不受影响
do $$ declare r integer; begin
  create temp table progress(user_id uuid, doc jsonb, rev integer);
  r := public.create_progress('{"owner":"B"}'::jsonb);
  perform pg_temp.ok('A15 B 建了同名临时表 progress，create_progress 仍写进 public.progress（rev 1）', r = 1 and (select count(*) from pg_temp.progress) = 0);
  drop table pg_temp.progress;
end $$;
reset role;
do $$ begin
  perform pg_temp.ok('A16 A 的行完好：内容还是 A 创建的、rev 还是 1', (select doc->>'owner' from public.progress where user_id = (select a from t)) = 'A' and (select rev from public.progress where user_id = (select a from t)) = 1);
  perform pg_temp.ok('A17 B 自己的行存在且归 B', (select count(*) from public.progress where user_id = (select b from t)) = 1);
end $$;

-- ===== B. 身份校验 =====
-- 1) anon + 冒用 A 的 uid：表和三个函数都没有权限
set local role anon;
select pg_temp.as_user((select a from t));
do $$ begin
  perform pg_temp.ok('B1 anon 即使带着 A 的 uid，也读不了表', pg_temp.try('select * from public.progress') = '42501');
  perform pg_temp.ok('B2 anon 不能调用 save_progress', pg_temp.try('select public.save_progress(1, ''{}'')') = '42501');
  perform pg_temp.ok('B3 anon 不能调用 delete_my_account', pg_temp.try('select public.delete_my_account()') = '42501');
end $$;
reset role;

-- 2) authenticated 但身份无效
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claim.sub', null, true);   -- 没有 sub
  perform pg_temp.ok('B4 没有 sub：create_progress 被拒绝(28000)', pg_temp.try('select public.create_progress(''{}'')') = '28000');
  perform pg_temp.ok('B5 没有 sub：save_progress 被拒绝(28000)', pg_temp.try('select public.save_progress(1, ''{}'')') = '28000');
  perform pg_temp.ok('B6 没有 sub：delete_my_account 被拒绝(28000)', pg_temp.try('select public.delete_my_account()') = '28000');
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.ok('B7 sub 为空字符串：被拒绝(28000)', pg_temp.try('select public.create_progress(''{}'')') = '28000');
  perform set_config('request.jwt.claim.sub', 'not-a-uuid', true);
  perform pg_temp.ok('B8 sub 不是 uuid：出错(22P02)，不会当成任何人', pg_temp.try('select public.create_progress(''{}'')') = '22P02');
  perform pg_temp.ok('B9 sub 不是 uuid：读表也出错，不会返回任何行', pg_temp.try('select count(*) from public.progress') = '22P02');
end $$;
-- 3) 令牌还有效、但账号已经不存在（被删 / 从没注册）：不能凭空创建，也改不到别人
select pg_temp.as_user((select ghost from t));
do $$ begin
  perform pg_temp.ok('B10 账号不存在：create_progress 被外键拒绝(23503)，不会留下无主的行', pg_temp.try('select public.create_progress(''{}'')') = '23503');
  perform pg_temp.ok('B11 账号不存在：save_progress → null', (select public.save_progress(1, '{}')) is null);
  perform pg_temp.ok('B12 账号不存在：读表 0 行', (select count(*) from public.progress) = 0);
end $$;
reset role;

-- 4) 删除账号后，旧令牌不能把数据建回来；行跟着账号一起删
set local role authenticated;
select pg_temp.as_user((select b from t));
select public.delete_my_account();
reset role;
set local role authenticated;
do $$ begin
  perform pg_temp.ok('B13 B 删号后，同一个令牌 create_progress 被拒绝(23503)', pg_temp.try('select public.create_progress(''{}'')') = '23503');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok('B14 B 的账号和进度都没了，A 的账号和进度还在', (select count(*) from auth.users where id = (select b from t)) = 0
    and (select count(*) from public.progress where user_id = (select b from t)) = 0
    and (select count(*) from public.progress where user_id = (select a from t)) = 1);
end $$;

-- ===== C. 文档校验（只影响自己的那一行）=====
set local role authenticated;
select pg_temp.as_user((select a from t));
do $$ declare big text := repeat('x', 70000); r integer; begin
  perform pg_temp.ok('C1 doc 是数组 → 拒绝(23514)', pg_temp.try('select public.save_progress(1, ''[]'')') = '23514');
  perform pg_temp.ok('C2 doc 是字符串 → 拒绝(23514)', pg_temp.try('select public.save_progress(1, ''"x"'')') = '23514');
  perform pg_temp.ok('C3 doc 是 JSON null → 拒绝(23514)', pg_temp.try('select public.save_progress(1, ''null'')') = '23514');
  perform pg_temp.ok('C4 doc 是 SQL null → 拒绝(23502)', pg_temp.try('select public.save_progress(1, null)') = '23502');
  perform pg_temp.ok('C5 70000 字节随机不可压缩内容 → 拒绝(23514)', pg_temp.try(format('select public.save_progress(1, jsonb_build_object(''k'', %L))', (select string_agg(md5(i::text), '') from generate_series(1, 4000) i))) = '23514');
  perform pg_temp.ok('C6 失败的保存不改动原内容，也不增加 rev', (select doc->>'owner' from public.progress) = 'A' and (select rev from public.progress) = 1);
  perform pg_temp.ok('C7 expected_rev 为 null / 0 / 负数 → 返回 null', (select public.save_progress(null, '{}')) is null and (select public.save_progress(0, '{}')) is null and (select public.save_progress(-1, '{}')) is null);
end $$;
reset role;
-- 可压缩的大文档：看 64KiB 的限制是按“未压缩”还是“压缩后”算
set local role authenticated;
select pg_temp.as_user((select a from t));
do $$ declare e text; begin
  e := pg_temp.try('select public.save_progress(1, jsonb_build_object(''k'', repeat(''x'', 1000000)))');
  raise notice 'INFO  C8 1,000,000 个字符（可压缩）的文档：保存结果 = %（ok=被接受；23514=被拒绝）', e;
end $$;
reset role;
select 'C8 结果 ↓' as note, rev, pg_column_size(doc) as stored_bytes, octet_length(doc::text) as json_bytes from public.progress where user_id = (select a from t);
rollback;
