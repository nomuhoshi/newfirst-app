-- 初始化验收（产品官 10:52 列的项目），在“模拟 Supabase 默认状态 + schema.sql 跑过两次”之后运行。整段在事务里，最后回滚。
begin;
create or replace function pg_temp.ok(name text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice 'PASS  %', name; else raise exception 'FAIL  %', name; end if; end $$;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); end $$;
create temp table ids(a uuid, b uuid, t uuid); insert into ids select gen_random_uuid(), gen_random_uuid(), gen_random_uuid();
grant select on ids to anon, authenticated;
insert into auth.users(id, email) select a, 'a@test' from ids; insert into auth.users(id, email) select b, 'b@test' from ids;
insert into auth.users(id, email) select t, 'delete-me@test' from ids;   -- 删号测试专用账号

-- P1 结构
select pg_temp.ok('P1.1 progress 表存在，RLS 开启且 FORCE', (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.progress'::regclass));
select pg_temp.ok('P1.2 只有一条策略：authenticated 只读自己的行', (select count(*)=1 and bool_and(cmd='SELECT' and roles='{authenticated}' and qual='(auth.uid() = user_id)') from pg_policies where schemaname='public' and tablename='progress'));
select pg_temp.ok('P1.3 约束：doc 必须是 JSON 对象、小于 64 KB', (select count(*)=2 from pg_constraint where conrelid='public.progress'::regclass and conname in ('doc_is_object','doc_not_huge')));
-- P2 表权限（Supabase 默认会把新表的全部权限授给 anon / authenticated，schema.sql 必须收回）
select pg_temp.ok('P2.1 anon 对表没有任何权限（默认授予的已收回）', not exists (select 1 from information_schema.role_table_grants where table_schema='public' and table_name='progress' and grantee='anon'));
select pg_temp.ok('P2.2 authenticated 只有 SELECT', (select array_agg(privilege_type order by privilege_type) = '{SELECT}' from information_schema.role_table_grants where table_schema='public' and table_name='progress' and grantee='authenticated'));
-- P3 函数权限（Supabase 默认会把新函数的 EXECUTE 授给 anon，schema.sql 必须收回）
select pg_temp.ok('P3.1 三个函数：anon 不能执行', (select bool_and(not has_function_privilege('anon', p.oid, 'execute')) and count(*)=3 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_progress','save_progress','delete_my_account')));
select pg_temp.ok('P3.2 三个函数：authenticated 能执行', (select bool_and(has_function_privilege('authenticated', p.oid, 'execute')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_progress','save_progress','delete_my_account')));
select pg_temp.ok('P3.3 三个函数：PUBLIC 没有 EXECUTE（proacl 里没有 =X）', (select bool_and(not (array_to_string(p.proacl, ',') ~ '(^|,)=X')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_progress','save_progress','delete_my_account')));
select pg_temp.ok('P3.4 三个函数都是 SECURITY DEFINER 且固定 search_path', (select bool_and(p.prosecdef and array_to_string(p.proconfig, ',') like 'search_path=%') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_progress','save_progress','delete_my_account')));

-- P4 匿名
set local role anon;
do $$ declare e text; begin
  begin perform count(*) from public.progress; e:='allowed'; exception when insufficient_privilege then e:='denied'; end;
  perform pg_temp.ok('P4.1 匿名读表被拒绝', e='denied');
  begin perform public.save_progress(1, '{}'::jsonb); e:='allowed'; exception when insufficient_privilege then e:='denied'; end;
  perform pg_temp.ok('P4.2 匿名调用 save_progress 被拒绝', e='denied');
  begin perform public.create_progress('{}'::jsonb); e:='allowed'; exception when insufficient_privilege then e:='denied'; end;
  perform pg_temp.ok('P4.3 匿名调用 create_progress 被拒绝', e='denied');
  begin perform public.delete_my_account(); e:='allowed'; exception when insufficient_privilege then e:='denied'; end;
  perform pg_temp.ok('P4.4 匿名调用 delete_my_account 被拒绝', e='denied');
end $$;
reset role;

-- P5 跨账号 / 直接写表 / 版本冲突 / 文档约束（authenticated 身份）
set local role authenticated;
select pg_temp.as_user((select a from ids));
select pg_temp.ok('P5.1 A 首次创建 → rev 1', public.create_progress('{"xp":{"d":10}}') = 1);
select pg_temp.ok('P5.2 A 再次创建 → null（不覆盖）', public.create_progress('{"xp":{"d":999}}') is null);
select pg_temp.ok('P5.3 A 按 rev 1 保存 → rev 2', public.save_progress(1, '{"xp":{"d":20}}') = 2);
select pg_temp.ok('P5.4 版本冲突：A 拿旧的 rev 1 再保存 → null', public.save_progress(1, '{"xp":{"d":30}}') is null);
select pg_temp.ok('P5.5 版本冲突后内容没被改（仍是 xp 20、rev 2）', (select doc->'xp'->>'d' = '20' and rev = 2 from public.progress));
do $$ declare e text; begin
  begin insert into public.progress(user_id, doc) values ((select a from ids), '{}'); e:='allowed'; exception when insufficient_privilege then e:='denied'; end;
  perform pg_temp.ok('P5.6 直接 INSERT 被拒绝', e='denied');
  begin update public.progress set rev = 99; e:='allowed'; exception when insufficient_privilege then e:='denied'; end;
  perform pg_temp.ok('P5.7 直接 UPDATE 被拒绝', e='denied');
  begin delete from public.progress; e:='allowed'; exception when insufficient_privilege then e:='denied'; end;
  perform pg_temp.ok('P5.8 直接 DELETE 被拒绝', e='denied');
  begin perform public.save_progress(2, '[1,2,3]'::jsonb); e:='allowed'; exception when check_violation then e:='rejected'; end;
  perform pg_temp.ok('P5.9 doc 不是对象（数组）→ 被约束拒绝', e='rejected');
  begin perform public.save_progress(2, jsonb_build_object('pad', repeat(md5(random()::text), 4000))); e:='allowed'; exception when check_violation then e:='rejected'; end;
  perform pg_temp.ok('P5.10 doc 超过 64 KB → 被约束拒绝', e='rejected');
end $$;
select pg_temp.as_user((select b from ids));
select pg_temp.ok('P5.11 跨账号：B 读不到 A 的行（0 行）', (select count(*) from public.progress) = 0);
select pg_temp.ok('P5.12 跨账号：B 用 A 的 rev 2 保存 → null（只会找 B 自己的行）', public.save_progress(2, '{"hack":true}') is null);
-- P6 删号（专用测试账号）
select pg_temp.as_user((select t from ids));
select pg_temp.ok('P6.1 测试账号 T 创建进度 → rev 1', public.create_progress('{"t":1}') = 1);
select public.delete_my_account();
reset role;
select pg_temp.ok('P6.2 T 删号后：T 的账号和进度行都没了', not exists (select 1 from auth.users where id=(select t from ids)) and not exists (select 1 from public.progress where user_id=(select t from ids)));
select pg_temp.ok('P6.3 A 的行还在且没被改（xp 20、rev 2）', (select doc->'xp'->>'d' = '20' and rev = 2 from public.progress where user_id=(select a from ids)));
select pg_temp.ok('P6.4 已存在的正式账号保持不变（初始化前就有、没有进度行）', exists (select 1 from auth.users where email='existing-owner@example.com') and not exists (select 1 from public.progress where user_id='00000000-0000-0000-0000-00000000e001'));
rollback;
