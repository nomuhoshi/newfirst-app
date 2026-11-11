#!/usr/bin/env bash
# 正式 Supabase 初始化变更包（supabase/prod-init/）的本地演练：真实 PostgreSQL，模拟 Supabase 新项目的默认状态。
#   - 临时实例只监听 Unix 套接字，跑完销毁；不继承 PG* 环境变量（同 run-all.sh）。
#   - 模拟：anon / authenticated / service_role 角色、auth.users、auth.uid()、public 默认权限（新表新函数自动授给三个角色）、
#           Supabase 文档原版的 rls_auto_enable 事件触发器、一个已存在的正式账号。
#   - 这不等于真实 Supabase：属主是否有 BYPASSRLS、SQL Editor 对 begin/commit 的处理、Auth 配置，都要在真实项目上核对（00-precheck / 02-postcheck）。
# 用法：bash supabase/tests/prod-init-local.sh
set -uo pipefail
die() { echo "错误：$*" >&2; exit 2; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; D="$(cd "$HERE/.." && pwd)"; PI="$D/prod-init"
for v in $(compgen -e | grep '^PG' || true); do unset "$v"; done
if [ "$(id -u)" = 0 ]; then id postgres >/dev/null 2>&1 || die "root 运行但没有 postgres 用户"; exec runuser -u postgres -- bash "$0" "$@"; fi
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"; [ -x "$BIN/initdb" ] || die "找不到 PostgreSQL"
export PATH="$BIN:$PATH"
W="$(mktemp -d "${TMPDIR:-/tmp}/suipian-prodinit.XXXXXX")"; chmod 700 "$W"; mkdir "$W/sock"
trap 'pg_ctl -D "$W/data" -m immediate -w stop >/dev/null 2>&1; rm -rf "$W"' EXIT
initdb -D "$W/data" -U postgres -A trust --no-sync -E UTF8 --locale=C >"$W/initdb.log" 2>&1 || die "initdb 失败"
PORT=$((20000 + RANDOM % 20000))
pg_ctl -D "$W/data" -l "$W/pg.log" -w -o "-c listen_addresses='' -c unix_socket_directories=$W/sock -c port=$PORT -c fsync=off" start >/dev/null 2>&1 || die "启动失败"
export PGHOST="$W/sock" PGPORT="$PORT" PGUSER=postgres
[ "$(psql -qAt -d postgres -c 'show listen_addresses')" = "" ] || die "实例在监听网络"
pass=0; fail=0
ok() { if [ "$2" = 1 ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1"; fail=$((fail+1)); fi; }
newdb() { psql -qAt -d postgres -c "drop database if exists $1" -c "create database $1" >/dev/null && psql -v ON_ERROR_STOP=1 -qAt -d "$1" -f "$D/tests/stub.sql" -f "$D/tests/supabase-like.sql" >/dev/null 2>&1; }
Q() { psql -qAt -d "$@"; }

echo "== A 正常路径：只读核查 → 初始化 → 重复初始化 → 验收 → 复核"
newdb pa || die "模拟环境失败"
cat0="$(Q pa -c "select md5(string_agg(c.oid::text||c.relname, ',' order by c.oid)) from pg_class c")"
psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$PI/00-precheck.sql" >"$W/pre.txt" 2>&1; ok "A0 00-precheck.sql 能运行" $([ $? = 0 ] && echo 1 || echo 0)
ok "A1 00-precheck.sql 不改任何对象（pg_class 前后一致）" $([ "$(Q pa -c "select md5(string_agg(c.oid::text||c.relname, ',' order by c.oid)) from pg_class c")" = "$cat0" ] && echo 1 || echo 0)
psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$PI/01-init.sql" >"$W/i1.txt" 2>&1; ok "A2 01-init.sql 第 1 次：成功且自检通过" $(grep -q "初始化自检通过" "$W/i1.txt" && echo 1 || echo 0)
Q pa -f "$D/tests/prod-init-snapshot.sql" >"$W/s1.txt"
psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$PI/01-init.sql" >"$W/i2.txt" 2>&1; ok "A3 01-init.sql 第 2 次（重复执行）：成功且自检通过" $(grep -q "初始化自检通过" "$W/i2.txt" && echo 1 || echo 0)
Q pa -f "$D/tests/prod-init-snapshot.sql" >"$W/s2.txt"
ok "A4 重复执行前后：表权限、策略、函数定义与授权、约束、RLS 一致（$(wc -l <"$W/s1.txt") 项）" $(cmp -s "$W/s1.txt" "$W/s2.txt" && echo 1 || echo 0)
OUT="$(psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$D/tests/prod-init-acceptance.sql" 2>&1)"; rc=$?
echo "$OUT" | grep -o 'PASS  .*\|FAIL  .*' | sed 's/^/    /'
n="$(echo "$OUT" | grep -c 'PASS  ')"; ok "A5 验收 $n 项全部通过（匿名、跨账号、直接写表、版本冲突、文档约束、删号用专用测试账号、已有账号不变）" $([ $rc = 0 ] && [ "$n" = 29 ] && echo 1 || echo 0)
psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$PI/02-postcheck.sql" >"$W/post.txt" 2>&1; ok "A6 02-postcheck.sql 能运行" $([ $? = 0 ] && echo 1 || echo 0)
ok "A7 已存在的正式账号仍在" $([ "$(Q pa -c "select count(*) from auth.users where email='existing-owner@example.com'")" = 1 ] && echo 1 || echo 0)

echo "== B 失败自动回滚：库里已有同名但不兼容的函数 → 01-init.sql 中途出错 → 什么都不留下"
newdb pb || die "模拟环境失败"
Q pb -c "create function public.save_progress(expected_rev integer, new_doc jsonb) returns text language sql as 'select ''x''';" >/dev/null
psql -v ON_ERROR_STOP=1 -qAt -d pb -f "$PI/01-init.sql" >"$W/fb.txt" 2>&1; rcb=$?
ok "B1 01-init.sql 报错退出" $([ $rcb != 0 ] && echo 1 || echo 0)
ok "B2 回滚干净：progress 表没有建出来，create_progress 也不存在" $([ "$(Q pb -c "select to_regclass('public.progress') is null and to_regprocedure('public.create_progress(jsonb)') is null")" = t ] && echo 1 || echo 0)

echo "== C 自检兜底：函数属主没有 BYPASSRLS 时，自检拒绝提交"
newdb pc || die "模拟环境失败"
Q pc -c "create role owner_nobypass nologin; grant create, usage on schema public to owner_nobypass; grant usage on schema auth to owner_nobypass; grant select, references on auth.users to owner_nobypass;" >/dev/null
{ echo "set role owner_nobypass;"; sed 's/^commit;$/reset role; commit;/' "$PI/01-init.sql"; } > "$W/init-as-nobypass.sql"
psql -v ON_ERROR_STOP=1 -qAt -d pc -f "$W/init-as-nobypass.sql" >"$W/fc.txt" 2>&1; rcc=$?; grep -o "初始化自检失败.*" "$W/fc.txt" | sed "s/^/    /"
ok "C1 自检报“函数属主没有 BYPASSRLS”并回滚" $([ $rcc != 0 ] && grep -q "BYPASSRLS" "$W/fc.txt" && [ "$(Q pc -c "select to_regclass('public.progress') is null")" = t ] && echo 1 || echo 0)

echo "== D 安全顾问修正草案：只收紧 rls_auto_enable，不误伤三个 RPC，自动开启 RLS 照常"
psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$PI/10-advisor-readonly.sql" >/dev/null 2>&1; ok "D0 10-advisor-readonly.sql 能运行" $([ $? = 0 ] && echo 1 || echo 0)
ok "D1 修正前：anon、authenticated 都能执行 rls_auto_enable（Supabase 默认权限造成，告警来源）" $([ "$(Q pa -c "select has_function_privilege('anon','public.rls_auto_enable()','execute') and has_function_privilege('authenticated','public.rls_auto_enable()','execute')")" = t ] && echo 1 || echo 0)
psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$PI/11-advisor-fix.sql" >/dev/null 2>&1; ok "D2 11-advisor-fix.sql 成功（含自带检查）" $([ $? = 0 ] && echo 1 || echo 0)
ok "D3 修正后：anon、authenticated 都不能执行 rls_auto_enable" $([ "$(Q pa -c "select not has_function_privilege('anon','public.rls_auto_enable()','execute') and not has_function_privilege('authenticated','public.rls_auto_enable()','execute')")" = t ] && echo 1 || echo 0)
ok "D4 修正后：authenticated 仍能执行三个 RPC" $([ "$(Q pa -c "select bool_and(has_function_privilege('authenticated', p.oid, 'execute')) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('create_progress','save_progress','delete_my_account')")" = t ] && echo 1 || echo 0)
Q pa -c "create role ddl_user nologin; grant create, usage on schema public to ddl_user;" >/dev/null
Q pa -c "set role ddl_user; create table public.after_fix(x int);" >/dev/null 2>&1
ok "D5 修正后：非超级用户新建 public 表，事件触发器照常自动开启 RLS" $([ "$(Q pa -c "select relrowsecurity from pg_class where oid='public.after_fix'::regclass")" = t ] && echo 1 || echo 0)
OUT="$(psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$D/tests/prod-init-acceptance.sql" 2>&1)"; ok "D6 修正后：初始化验收 29 项仍全部通过" $([ $? = 0 ] && [ "$(echo "$OUT" | grep -c 'PASS  ')" = 29 ] && echo 1 || echo 0)

echo "== E 回滚脚本：有进度行时拒绝，空表时可撤回"
Q pa -c "insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000aa','row@test'); insert into public.progress(user_id, doc) values ('00000000-0000-0000-0000-0000000000aa','{}');" >/dev/null
psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$PI/03-rollback.sql" >"$W/rb1.txt" 2>&1; rce=$?
ok "E1 有 1 行进度时 03-rollback.sql 拒绝执行，表和数据都在" $([ $rce != 0 ] && grep -q "拒绝回滚" "$W/rb1.txt" && [ "$(Q pa -c "select count(*) from public.progress")" = 1 ] && echo 1 || echo 0)
Q pa -c "delete from public.progress;" >/dev/null
psql -v ON_ERROR_STOP=1 -qAt -d pa -f "$PI/03-rollback.sql" >/dev/null 2>&1
ok "E2 空表时 03-rollback.sql 撤回表和三个函数；账号不受影响" $([ "$(Q pa -c "select to_regclass('public.progress') is null and to_regprocedure('public.delete_my_account()') is null and (select count(*) from auth.users where email='existing-owner@example.com') = 1")" = t ] && echo 1 || echo 0)

echo; echo "合计 $((pass+fail)) 项，失败 $fail 项"; [ $fail = 0 ] && [ $((pass+fail)) = 20 ] && { echo 全部通过; exit 0; } || exit 1
