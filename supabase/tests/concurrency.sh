#!/usr/bin/env bash
# 并发保护验证：两个会话用同一个 expected_rev 同时保存，只能成功一个。
# 用法：先在测试库里跑 stub.sql 和 schema.sql；PSQL="psql -h /tmp/pgt -p 5544 -U postgres -d t1 -q" bash concurrency.sh
set -e
P="${PSQL:-psql -q}"; U=11111111-1111-1111-1111-111111111111
$P -c "insert into auth.users(id,email) values ('$U','c@t') on conflict do nothing" -c "insert into public.progress(user_id,doc,rev) values ('$U','{\"x\":0}',1) on conflict (user_id) do update set rev=1, doc='{\"x\":0}'"
S="set role authenticated; select set_config('request.jwt.claim.sub','$U',false);"
( $P -At -c "$S" -c "begin" -c "select 's1:' || coalesce(public.save_progress(1,'{\"w\":1}')::text,'null')" -c "select pg_sleep(2)" -c "commit" | grep s1: > /tmp/conc1 ) &
sleep 0.7
$P -At -c "$S" -c "select 's2:' || coalesce(public.save_progress(1,'{\"w\":2}')::text,'null')" | grep s2: > /tmp/conc2
wait
r1=$(cat /tmp/conc1); r2=$(cat /tmp/conc2); echo "$r1 $r2"
[ "$r1" = "s1:2" ] && [ "$r2" = "s2:null" ] && echo "PASS 同一 expected_rev 的并发保存只成功一个" || { echo "FAIL"; exit 1; }
