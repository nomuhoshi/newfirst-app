-- 变更包第 2 步：初始化后只读复核（只有 select）。期望值写在每段注释里；和本地测试 prod-init-local.sh 的结论一一对应。
-- 1. 表结构（期望：user_id uuid / doc jsonb / rev integer / updated_at timestamptz）
select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='progress' order by ordinal_position;
-- 2. RLS（期望：rls_on = true，rls_forced = true）
select relname, relrowsecurity as rls_on, relforcerowsecurity as rls_forced from pg_class where oid = 'public.progress'::regclass;
-- 3. 约束（期望：doc_is_object、doc_not_huge、rev 检查、主键、外键 on delete cascade）
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.progress'::regclass order by conname;
-- 4. 策略（期望：1 条，SELECT，roles {authenticated}，qual (auth.uid() = user_id)）
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' and tablename='progress';
-- 5. 表权限（期望：anon 没有任何一行；authenticated 只有 SELECT；service_role 有全部权限是 Supabase 默认，service_role 密钥只在服务端，不在前端）
select grantee, string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema='public' and table_name='progress' group by grantee order by grantee;
-- 6. 三个函数（期望：3 行，security_definer = true，proconfig 有 search_path，属主能绕过 RLS）
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.proconfig, pg_get_userbyid(p.proowner) as owner,
       (select rolsuper or rolbypassrls from pg_roles where oid = p.proowner) as owner_bypasses_rls, p.proacl
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('create_progress','save_progress','delete_my_account') order by p.proname;
-- 7. 执行权限（期望：anon = false，authenticated = true）
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as authenticated
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('create_progress','save_progress','delete_my_account') order by p.proname;
-- 8. 行数（期望：初始化刚完成是 0；只看数量）
select count(*) as progress_rows from public.progress;
-- 9. 事件触发器仍在（期望：ensure_rls 启用，函数 rls_auto_enable）
select evtname, evtenabled, evtfoid::regprocedure from pg_event_trigger order by evtname;
