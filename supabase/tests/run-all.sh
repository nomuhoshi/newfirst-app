#!/usr/bin/env bash
# 一次跑完全部数据库权限测试（本机临时 PostgreSQL，Unix 套接字，不连 Supabase）。
# 前提：已有一个本机 PostgreSQL 在运行，当前用户可以以 postgres 超级用户身份连接。
#   PGHOST=/tmp/pgrev/run PGPORT=5544 bash supabase/tests/run-all.sh
set -u
D="$(cd "$(dirname "$0")/.." && pwd)"; T="$D/tests"
SU="psql -U postgres -v ON_ERROR_STOP=1 -q"
fails=0
$SU -d postgres -c "drop database if exists rv1" -c "create database rv1" >/dev/null 2>&1
$SU -d rv1 -f "$T/stub.sql" -f "$D/schema.sql" >/dev/null 2>&1
$SU -d postgres -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if; end \$\$" -c "grant anon, authenticated to authenticator" >/dev/null 2>&1
echo "== isolation.sql（原有）"; out=$($SU -d rv1 -f "$T/isolation.sql" 2>&1); echo "$out" | grep -c "PASS"; echo "$out" | grep -q "FAIL\|ERROR" && { echo "$out" | grep "FAIL\|ERROR"; fails=$((fails+1)); }
echo "== concurrency.sh（原有）"; PSQL="psql -U postgres -d rv1 -q" bash "$T/concurrency.sh" || fails=$((fails+1))
echo "== review-1.sql（跨账号 / 身份校验 / 文档校验）"; out=$($SU -d rv1 -f "$T/review-1.sql" 2>&1); echo "PASS $(echo "$out" | grep -c 'PASS ')，INFO:"; echo "$out" | grep "INFO"; echo "$out" | grep -q "FAIL\|ERROR" && { echo "$out" | grep "FAIL\|ERROR"; fails=$((fails+1)); }
echo "== review-2.sh（登录角色 / FORCE RLS / 旧版升级）"; bash "$T/review-2.sh" "$D" "$T/schema-old-v1.sql" || fails=$((fails+1))
echo; [ "$fails" = 0 ] && echo "全部通过" || { echo "有 $fails 组失败"; exit 1; }
