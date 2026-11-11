-- 安全顾问告警修正（草案；拿到三条告警原文、跑完 10-advisor-readonly.sql 后定稿，需授权后运行）。
-- 只收紧 rls_auto_enable：它返回 event_trigger，只能由事件触发器调用，任何角色直接调用都会报错；
-- 事件触发器触发时不检查调用者的 EXECUTE 权限，所以收回后自动开启 RLS 照常工作（本地 PostgreSQL 16 实测，见 README §安全顾问）。
-- 不碰 create_progress / save_progress / delete_my_account：应用需要 authenticated 能执行它们。
begin;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is null then
    raise notice '本项目没有 public.rls_auto_enable()，不需要收紧，什么都没做';
    return;
  end if;
  execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  if has_function_privilege('anon', 'public.rls_auto_enable()', 'execute') or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute') then
    raise exception '收紧失败：anon / authenticated 仍能执行 rls_auto_enable';
  end if;
  -- 探针：收紧后新建一张 public 表，ensure_rls 必须照常给它开 RLS；探针表随即删除（都在本事务里）
  if exists (select 1 from pg_event_trigger where evtfoid = 'public.rls_auto_enable()'::regprocedure and evtenabled <> 'D') then
    execute 'create table public._rls_probe_after_fix (x int)';
    if not (select relrowsecurity from pg_class where oid = 'public._rls_probe_after_fix'::regclass) then
      raise exception '收紧后 ensure_rls 没有给新表开 RLS，已回滚';
    end if;
    execute 'drop table public._rls_probe_after_fix';
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('create_progress','save_progress','delete_my_account') and not has_function_privilege('authenticated', p.oid, 'execute')) then
    raise exception '误伤：authenticated 不能执行应用需要的函数了';
  end if;
end $$;
commit;
