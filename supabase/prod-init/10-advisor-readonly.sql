-- 安全顾问告警：只读核查（只有 select）。配合“三条告警原文”一起看，再决定 11-advisor-fix.sql 的最终内容。
-- 1. rls_auto_enable 的定义、执行身份、search_path、属主、授权
select p.oid::regprocedure as fn, pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer, p.proconfig, p.prorettype::regtype as returns, p.proacl,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec, has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec
  from pg_proc p where p.proname = 'rls_auto_enable';
select pg_get_functiondef(p.oid) from pg_proc p where p.proname = 'rls_auto_enable';
-- 2. 依赖它的事件触发器（期望：ensure_rls，ddl_command_end）
select e.evtname, e.evtevent, e.evtenabled, e.evttags from pg_event_trigger e join pg_proc p on p.oid = e.evtfoid where p.proname = 'rls_auto_enable';
-- 3. public 里所有 SECURITY DEFINER 函数，以及 anon / authenticated 能否执行（看告警还点到了哪些函数）
select p.oid::regprocedure as fn, p.prosecdef, p.prorettype::regtype as returns, has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec, p.proacl
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef order by 1;
