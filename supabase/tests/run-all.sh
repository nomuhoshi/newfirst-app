#!/usr/bin/env bash
# 一次跑完全部数据库权限测试。自己创建专用的临时 PostgreSQL 实例，跑完销毁：
#   - 数据目录和套接字都在 mktemp 出来的新目录里；listen_addresses 为空（不监听任何网络），只有 Unix 套接字，所以连不到 Supabase 或其他数据库；
#   - 不继承环境里的 PG* 变量，不会误连到别的库；脚本里的 drop database 只发生在这个新实例里；
#   - 初始化失败立即退出；任何测试命令非零退出都算失败；检查项数必须等于预期（防止测试被悄悄跳过）。
# 用法：bash supabase/tests/run-all.sh      （需要 PostgreSQL 14+ 的 initdb / pg_ctl / psql；可用 PG_BIN=<bin 目录> 指定）
set -uo pipefail
die() { echo "错误：$*" >&2; exit 2; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; D="$(cd "$HERE/.." && pwd)"
for f in schema.sql tests/stub.sql tests/isolation.sql tests/concurrency.sh tests/review-1.sql tests/review-2.sh tests/schema-old-v1.sql; do [ -f "$D/$f" ] || die "缺少文件 supabase/$f"; done
# 预期的检查项数：原有 isolation 18、review-1 37；review-2 在脚本内部有自己的 EXPECTED。新增或删除检查时同步修改这里。
EXP_ISOLATION=18; EXP_REVIEW1=37
# 1. 不继承任何 PG* 环境变量
for v in $(compgen -e | grep '^PG' || true); do unset "$v"; done
# 2. initdb 不能以 root 运行：root 时降权成 postgres 用户重新执行
if [ "$(id -u)" = 0 ]; then
  id postgres >/dev/null 2>&1 || die "以 root 运行但没有 postgres 用户可降权"
  exec runuser -u postgres -- env PG_BIN="${PG_BIN:-}" bash "$0" "$@"
fi
# 3. 找 PostgreSQL 程序
BIN="${PG_BIN:-}"
if [ -z "$BIN" ] && command -v pg_config >/dev/null 2>&1; then BIN="$(pg_config --bindir)"; fi
if [ -z "$BIN" ]; then BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"; fi
for b in initdb pg_ctl psql; do [ -x "$BIN/$b" ] || die "找不到 $BIN/$b（可用 PG_BIN=<bin 目录> 指定）"; done
export PATH="$BIN:$PATH"
# 4. 专用临时实例
W="$(mktemp -d "${TMPDIR:-/tmp}/suipian-dbtest.XXXXXX")" || die "建不了临时目录"; chmod 700 "$W"
cleanup() { if [ -f "$W/data/postmaster.pid" ]; then pg_ctl -D "$W/data" -m immediate -w stop >/dev/null 2>&1 || true; fi; rm -rf "$W"; }
trap cleanup EXIT
mkdir -p "$W/sock"
initdb -D "$W/data" -U postgres -A trust --no-sync -E UTF8 --locale=C >"$W/initdb.log" 2>&1 || { cat "$W/initdb.log" >&2; die "initdb 失败"; }
PORT=$((20000 + RANDOM % 20000))
pg_ctl -D "$W/data" -l "$W/pg.log" -w -o "-c listen_addresses='' -c unix_socket_directories=$W/sock -c port=$PORT -c fsync=off -c synchronous_commit=off -c max_connections=40" start >"$W/start.log" 2>&1 || { cat "$W/start.log" "$W/pg.log" >&2; die "启动临时 PostgreSQL 失败"; }
export PGHOST="$W/sock" PGPORT="$PORT" PGUSER=postgres
SU=(psql -v ON_ERROR_STOP=1 -q -At)
# 5. 确认真的连在自己的实例上，且没有监听网络
[ "$("${SU[@]}" -d postgres -c 'show listen_addresses')" = "" ] || die "实例在监听网络，拒绝继续"
[ "$("${SU[@]}" -d postgres -c 'show data_directory')" = "$W/data" ] || die "连到的不是专用实例，拒绝继续"
fails=0
note_fail() { echo "失败：$1"; fails=$((fails+1)); }
run() { # run <名字> <命令…>：输出原样打印；非零退出码记为失败；把输出放进变量 OUT
  local name="$1"; shift; echo "== $name"
  OUT="$("$@" 2>&1)"; local rc=$?
  echo "$OUT"
  [ $rc = 0 ] || note_fail "$name 退出码 $rc"
  return 0
}
"${SU[@]}" -d postgres -c "create database rv1" || die "建库失败"
"${SU[@]}" -d rv1 -f "$D/tests/stub.sql" -f "$D/schema.sql" >"$W/init-rv1.log" 2>&1 || { cat "$W/init-rv1.log" >&2; die "初始化 rv1（stub.sql + schema.sql）失败"; }

run "isolation.sql（原有）" "${SU[@]}" -d rv1 -f "$D/tests/isolation.sql"
n=$(echo "$OUT" | grep -c 'PASS'); echo "PASS 行数：$n（预期 $EXP_ISOLATION）"
[ "$n" = "$EXP_ISOLATION" ] || note_fail "isolation 检查项数 $n ≠ $EXP_ISOLATION"
echo "$OUT" | grep -q 'FAIL' && note_fail "isolation 输出含 FAIL"

run "concurrency.sh（原有）" env PSQL="psql -q -d rv1" bash "$D/tests/concurrency.sh"

run "review-1.sql（跨账号 / 身份校验 / 文档校验）" "${SU[@]}" -d rv1 -f "$D/tests/review-1.sql"
n=$(echo "$OUT" | grep -c 'PASS '); echo "PASS 行数：$n（预期 $EXP_REVIEW1）"
[ "$n" = "$EXP_REVIEW1" ] || note_fail "review-1 检查项数 $n ≠ $EXP_REVIEW1"
echo "$OUT" | grep -q 'FAIL' && note_fail "review-1 输出含 FAIL"

run "review-2.sh（登录角色 / FORCE RLS / 旧版升级）" bash "$D/tests/review-2.sh" "$D" "$D/tests/schema-old-v1.sql"
echo "$OUT" | grep -q '^FAIL' && note_fail "review-2 输出含 FAIL"

echo
if [ "$fails" = 0 ]; then echo "全部通过"; else echo "有 $fails 项失败"; exit 1; fi
