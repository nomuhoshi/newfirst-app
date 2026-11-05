-- 只读检查：粘贴到 Supabase 控制台 → SQL Editor 运行。只有 select，不改任何数据，不需要 secret/service_role 密钥。
-- 逐段看结果；“期望”写在每段注释里。

-- 1. progress 表存在、列正确（期望：user_id uuid、doc jsonb、rev integer 等，和 supabase/schema.sql 一致）
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'progress'
order by ordinal_position;

-- 2. 行级安全已开启（期望：relrowsecurity = true）
select c.relname, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'progress';

-- 3. 策略（期望：只有一条 select 策略「只读自己的进度」，using auth.uid() = user_id；没有 insert/update/delete 策略）
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'progress';

-- 4. 表权限（期望：anon 没有任何权限；authenticated 只有 SELECT，没有 INSERT/UPDATE/DELETE）
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'progress'
order by grantee, privilege_type;

-- 5. 三个函数存在，且是 security definer、固定了 search_path（期望：3 行；security_definer = true；proconfig 里有 search_path）
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('create_progress', 'save_progress', 'delete_my_account')
order by p.proname;

-- 6. 函数执行权限（期望：authenticated = true；anon = false；public 没有）
select p.proname,
       has_function_privilege('anon', p.oid, 'execute')          as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_run
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('create_progress', 'save_progress', 'delete_my_account')
order by p.proname;

-- 7. 目前有多少行（只看数量，不显示别人的进度内容）。验收前应该是 0 或只有测试账号
select count(*) as progress_rows from public.progress;

-- ===== 以下 8–11 来自 docs/35 数据库权限复核（本机测不了、必须在真实库确认的部分），同样只有 select =====

-- 8. 三个函数的属主，以及属主能不能绕过行级安全（期望：rolbypassrls = true，或者表没有开 FORCE ROW LEVEL SECURITY）
--    原因：progress 表开了 FORCE ROW LEVEL SECURITY，函数是 security definer，以属主身份写表；属主没有 BYPASSRLS 时，create_progress / save_progress 会报
--    “new row violates row-level security policy”。本机已复现这个现象，但 Supabase 的 postgres 角色是否有 BYPASSRLS 只能在真实库查。
select p.proname, r.rolname as owner, r.rolsuper, r.rolbypassrls,
       (select c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'progress') as table_force_rls,
       (select pg_get_userbyid(c.relowner) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'progress') as table_owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid = p.proowner
where n.nspname = 'public' and p.proname in ('create_progress', 'save_progress', 'delete_my_account')
order by p.proname;

-- 9. 登录用户（anon / authenticated）能不能在 public 里建对象（期望：都是 false；true 的话，别人可以在 public 里建同名函数 / 运算符，干扰 search_path = public 的函数）
select has_schema_privilege('anon', 'public', 'create') as anon_can_create,
       has_schema_privilege('authenticated', 'public', 'create') as authenticated_can_create;

-- 10. public 里的默认授权（期望：看到的就是 Supabase 默认的 anon / authenticated / service_role 全权限——这就是 schema.sql 每次都要在建函数后 revoke 的原因；以后新增函数 / 表，必须同样 revoke 再 grant）
select pg_get_userbyid(d.defaclrole) as for_role, d.defaclobjtype as object_type, d.defaclacl::text as acl
from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public' or d.defaclnamespace = 0
order by 1, 2;

-- 11. 有没有匿名登录的账号（Supabase 的“匿名登录”开启后，匿名用户的角色也是 authenticated，也能调用这三个函数；期望：0，或者你确认过这是想要的）
select count(*) filter (where is_anonymous) as anonymous_users, count(*) as all_users from auth.users;
