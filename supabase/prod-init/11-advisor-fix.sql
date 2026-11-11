-- 安全顾问告警修正（草案；拿到三条告警原文、跑完 10-advisor-readonly.sql 后定稿，需授权后运行）。
-- 只收紧 rls_auto_enable：它返回 event_trigger，只能由事件触发器调用，任何角色直接调用都会报错；
-- 事件触发器触发时不检查调用者的 EXECUTE 权限，所以收回后自动开启 RLS 照常工作（本地 PostgreSQL 16 实测，见 README §安全顾问）。
-- 不碰 create_progress / save_progress / delete_my_account：应用需要 authenticated 能执行它们。
begin;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
do $$ begin
  if has_function_privilege('anon', 'public.rls_auto_enable()', 'execute') or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute') then
    raise exception '收紧失败：anon / authenticated 仍能执行 rls_auto_enable';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('create_progress','save_progress','delete_my_account') and not has_function_privilege('authenticated', p.oid, 'execute')) then
    raise exception '误伤：authenticated 不能执行应用需要的函数了';
  end if;
end $$;
commit;
