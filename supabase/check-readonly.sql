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
