-- （prod-init-local.sh 使用）
-- 本地模拟 Supabase 新项目的“默认状态”（只用于本地测试，不要在 Supabase 运行）：
-- 角色 anon / authenticated / service_role；public 模式的默认权限（新表、新函数自动授给这三个角色，和 Supabase 一致）；
-- 自动开启 RLS 的事件触发器 rls_auto_enable（Supabase 文档的原版）；一个已存在的正式账号（只有 auth.users，没有进度行）。
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.rls_auto_enable() RETURNS EVENT_TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') AND object_type IN ('table','partitioned table') LOOP
    IF cmd.schema_name IN ('public') THEN EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity); END IF;
  END LOOP;
END $$;
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable();
insert into auth.users(id, email) values ('00000000-0000-0000-0000-00000000e001', 'existing-owner@example.com');
alter table auth.users add column if not exists email_confirmed_at timestamptz, add column if not exists last_sign_in_at timestamptz;
