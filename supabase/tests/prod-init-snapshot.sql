-- 权限 / 策略 / 函数定义的快照（用于“重复执行前后一致”的比较）
select 'tbl', grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='progress'
union all select 'pol', policyname, cmd || ':' || coalesce(qual,'') from pg_policies where schemaname='public' and tablename='progress'
union all select 'fn', p.proname, md5(pg_get_functiondef(p.oid)) || ':' || p.prosecdef || ':' || coalesce(array_to_string(p.proconfig, ','), '') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_progress','save_progress','delete_my_account')
union all select 'acl', p.proname, coalesce(array_to_string(p.proacl, ','), '') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_progress','save_progress','delete_my_account')
union all select 'con', conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.progress'::regclass
union all select 'rls', relname, relrowsecurity || ':' || relforcerowsecurity from pg_class where oid='public.progress'::regclass
order by 1, 2, 3;
