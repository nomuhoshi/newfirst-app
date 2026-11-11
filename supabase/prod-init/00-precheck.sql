-- 变更包第 0 步：初始化前只读核查（只有 select，不改任何东西）。正式项目 aqlcunkmggzzvyavlkjg 和测试项目 tqdwhtrextqlmctkryyg 都跑一遍，结果原样贴回。
-- 不显示任何用户的进度内容或邮箱，只看数量和结构。

-- 0.1 确认连的是哪个库、什么版本、以什么身份运行（期望：SQL Editor 默认 postgres）
select current_database() as db, current_user as run_as, version() as pg_version, now() as checked_at;

-- 0.2 运行身份能否让 FORCE RLS 下的函数写表（期望：rolbypassrls = true 或 rolsuper = true；否则先停，见 README §失败处理 F2）
select rolname, rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname in (current_user, 'postgres', 'anon', 'authenticated', 'service_role', 'authenticator') order by rolname;

-- 0.3 现有业务对象（期望正式库：progress 表不存在、三个函数不存在；测试库：都存在）
select 'table' as kind, c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as rls_forced
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') order by c.relname;
select 'function' as kind, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.proconfig, pg_get_userbyid(p.proowner) as owner
  from pg_proc p where p.pronamespace = 'public'::regnamespace order by p.proname;

-- 0.4 public 模式的默认权限（Supabase 默认把新表 / 新函数授给 anon、authenticated；schema.sql 会对 progress 和三个函数收回）
select pg_get_userbyid(d.defaclrole) as for_role, d.defaclobjtype as obj_type, d.defaclacl
  from pg_default_acl d where d.defaclnamespace = 'public'::regnamespace;

-- 0.5 事件触发器（安全顾问提到的 rls_auto_enable 应挂在这里）
select evtname, evtevent, evtenabled, evttags, evtfoid::regprocedure as function from pg_event_trigger order by evtname;

-- 0.6 现有账号数量（只看数量；初始化不会改账号；期望正式库保留现有账号）
select count(*) as auth_users from auth.users;
select count(*) filter (where email_confirmed_at is not null) as confirmed, count(*) filter (where last_sign_in_at is not null) as signed_in_once from auth.users;

-- 0.7 rls_auto_enable 是否存在（决定 11-advisor-fix.sql 要不要做；没有就跳过那一步）
select to_regprocedure('public.rls_auto_enable()') is not null as rls_auto_enable_exists;

-- 0.8 迁移记录表在不在（用连接器的 apply_migration 时会多记录一条；SQL Editor 里直接运行不会记录）
select to_regclass('supabase_migrations.schema_migrations') is not null as has_migration_table;
-- 上面为 true 时再单独运行：select version, name from supabase_migrations.schema_migrations order by version;
