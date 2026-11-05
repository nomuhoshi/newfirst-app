#!/usr/bin/env bash
# 并发保护验证：两个会话用同一个 expected_rev 同时保存，必须恰好成功一个（另一个返回 null）。
# 用法：先在测试库里跑 stub.sql 和 schema.sql；PSQL="psql -q -d <库名>" bash concurrency.sh（连接信息来自 PGHOST/PGPORT，必须是本机 Unix 套接字）
set -euo pipefail
P="${PSQL:-psql -q}"; U=11111111-1111-1111-1111-111111111111
case "${PGHOST:-}" in /*) ;; *) echo "错误：PGHOST 必须是本机 Unix 套接字目录（绝对路径）" >&2; exit 2;; esac
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT      # 每次用新的临时目录：不会读到上一次留下的旧结果
$P -v ON_ERROR_STOP=1 -c "insert into auth.users(id,email) values ('$U','c@t') on conflict do nothing" -c "insert into public.progress(user_id,doc,rev) values ('$U','{\"x\":0}',1) on conflict (user_id) do update set rev = 1, doc = excluded.doc" >/dev/null
S="set role authenticated; select set_config('request.jwt.claim.sub','$U',false);"
# 会话 1：开事务、保存、睡 2 秒再提交（持有行锁）；会话 2 在 0.7 秒后用同一个 expected_rev 保存，会等到会话 1 提交
( $P -v ON_ERROR_STOP=1 -At -c "$S" -c "begin" -c "select 's1:' || coalesce(public.save_progress(1,'{\"w\":1}')::text,'null')" -c "select pg_sleep(2)" -c "commit" > "$T/o1" ) &
pid1=$!
sleep 0.7
$P -v ON_ERROR_STOP=1 -At -c "$S" -c "select 's2:' || coalesce(public.save_progress(1,'{\"w\":2}')::text,'null')" > "$T/o2"
wait "$pid1"                                   # 会话 1 出错（非零退出）时，这里会让脚本失败
r1=$(grep '^s1:' "$T/o1"); r2=$(grep '^s2:' "$T/o2")
echo "$r1 $r2"
# 恰好一个拿到新 rev(2)，另一个是 null；接受任一顺序（慢机器上会话 2 可能先到）
if { [ "$r1" = "s1:2" ] && [ "$r2" = "s2:null" ]; } || { [ "$r1" = "s1:null" ] && [ "$r2" = "s2:2" ]; }; then
  echo "PASS 同一 expected_rev 的并发保存只成功一个"
else echo "FAIL 并发保存结果不对：$r1 $r2"; exit 1; fi
