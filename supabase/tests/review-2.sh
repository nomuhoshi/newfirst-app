#!/usr/bin/env bash
# 数据库权限复核 2：用“非超级用户的登录角色”（模拟 PostgREST 的 authenticator）测提权、FORCE RLS 对函数的影响、旧版升级后旧记录保留。
# 只连本机临时 PostgreSQL（Unix 套接字），不连 Supabase。用法：
#   PGHOST=/tmp/pgrev/run PGPORT=5544 bash review-2.sh <supabase 目录> <旧版 schema 文件>
set -u
SB="$1"; OLD="$2"
SU="psql -U postgres -v ON_ERROR_STOP=1 -q -At"
AU() { psql -U authenticator -d "$1" -q -At "${@:2}"; }
pass=0; fail=0
ok() { if [ "$2" = "1" ]; then pass=$((pass+1)); echo "PASS  $1"; else fail=$((fail+1)); echo "FAIL  $1  ($3)"; fi; }
asu() { # asu 库 用户 SQL… ：以 authenticator 登录，set local role authenticated + 设置身份，再执行 SQL，输出最后一行
  local db="$1" uid="$2"; shift 2
  local args=(-c "begin" -c "set local role authenticated" -c "select set_config('request.jwt.claim.sub','$uid',true)")
  for q in "$@"; do args+=(-c "$q"); done
  AU "$db" "${args[@]}" 2>&1 | awk '/^ERROR/ {e=$0} {l=$0} END {print (e != "" ? e : l)}'   # 有错误就输出那行 ERROR，没有就输出最后一行
}
mkdbs() { $SU -d postgres -c "drop database if exists $1" -c "create database $1" >/dev/null 2>&1; $SU -d "$1" -f "$SB/tests/stub.sql" >/dev/null; }
$SU -d postgres -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if; end \$\$" -c "grant anon, authenticated to authenticator" >/dev/null 2>&1

echo "== R1 登录角色不是超级用户，也不能提权"
mkdbs r1; $SU -d r1 -f "$SB/schema.sql" >/dev/null 2>&1
A=aaaaaaaa-0000-0000-0000-000000000001
$SU -d r1 -c "insert into auth.users(id,email) values ('$A','a')"
r=$(AU r1 -c "select rolsuper::text || rolbypassrls::text from pg_roles where rolname = current_user"); ok "R1.1 authenticator 不是超级用户、没有 BYPASSRLS" "$([ "$r" = "falsefalse" ] && echo 1 || echo 0)" "$r"
r=$(asu r1 $A "set local role postgres"); ok "R1.2 登录后 set role authenticated，不能再 set role postgres" "$(echo "$r" | grep -q 'permission denied to set role' && echo 1 || echo 0)" "$r"
r=$(AU r1 -c "set role pg_read_all_data" 2>&1 | tail -1); ok "R1.3 不能 set role pg_read_all_data（内置的读全部数据角色）" "$(echo "$r" | grep -q 'permission denied to set role' && echo 1 || echo 0)" "$r"
r=$(AU r1 -c "select count(*) from public.progress" 2>&1 | tail -1); ok "R1.4 没 set role 时，authenticator 自己读不了表" "$(echo "$r" | grep -q 'permission denied for table progress' && echo 1 || echo 0)" "$r"
r=$(asu r1 $A "select public.create_progress('{\"o\":1}')"); ok "R1.5 正常路径：以登录角色身份 create_progress → 1" "$([ "$r" = "1" ] && echo 1 || echo 0)" "$r"

echo "== R2 FORCE ROW LEVEL SECURITY 与函数属主"
mkdbs r2
$SU -d r2 -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='fn_owner') then create role fn_owner login nosuperuser nobypassrls; end if; end \$\$" -c "alter role fn_owner nobypassrls" -c "grant create on schema public to fn_owner" -c "grant usage on schema auth to fn_owner" -c "grant references, delete, select on auth.users to fn_owner" -c "insert into auth.users(id,email) values ('$A','a')" >/dev/null
psql -U fn_owner -d r2 -q -f "$SB/schema.sql" >/dev/null 2>&1
r=$(asu r2 $A "select public.create_progress('{\"o\":1}')"); ok "R2.1 属主没有 BYPASSRLS 时，FORCE RLS 会让 create_progress 失败（说明：真实 Supabase 里 postgres 角色必须有 BYPASSRLS，本机测不了，见报告）" "$(echo "$r" | grep -q 'violates row-level security' && echo 1 || echo 0)" "$r"
$SU -d r2 -c "alter role fn_owner bypassrls" >/dev/null
r=$(asu r2 $A "select public.create_progress('{\"o\":1}')"); ok "R2.2 属主有 BYPASSRLS 时 create_progress 成功" "$([ "$r" = "1" ] && echo 1 || echo 0)" "$r"
$SU -d r2 -c "alter role fn_owner nobypassrls" -c "delete from public.progress" >/dev/null; psql -U fn_owner -d r2 -q -c "alter table public.progress no force row level security" >/dev/null
r=$(asu r2 $A "select public.create_progress('{\"o\":1}')"); ok "R2.3 去掉 FORCE 后，即使属主没有 BYPASSRLS 也成功（属主不受 RLS 约束）" "$([ "$r" = "1" ] && echo 1 || echo 0)" "$r"
r=$(asu r2 $A "update public.progress set doc='{}'"); ok "R2.4 去掉 FORCE 后，authenticated 依然不能直接写表（靠的是没有 UPDATE 权限）" "$(echo "$r" | grep -q 'permission denied' && echo 1 || echo 0)" "$r"

echo "== R3 旧版（直接写表 + 策略）升级到当前 schema，旧记录保留"
mkdbs r3
$SU -d r3 -c "alter default privileges for role postgres in schema public grant all on tables to anon, authenticated" -c "alter default privileges for role postgres in schema public grant all on functions to anon, authenticated" -c "alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated" >/dev/null   # 模拟 Supabase 的默认授权
$SU -d r3 -f "$OLD" >/dev/null 2>&1
U1=11111111-0000-0000-0000-000000000001; U2=22222222-0000-0000-0000-000000000002; U3=33333333-0000-0000-0000-000000000003; U4=44444444-0000-0000-0000-000000000004
$SU -d r3 -c "insert into auth.users(id,email) values ('$U1','u1'),('$U2','u2'),('$U3','u3'),('$U4','u4-no-row')" >/dev/null
# 旧记录用真实的账号文档格式（src/account-data.js：schema、gen、lineage、xp、runs、done、days、hearts、prefs、imported）
D1='{"schema":1,"gen":2,"lineage":"lin-AAAA","xp":{"devA":120,"devB":35},"runs":{"devA":9,"devB":3},"done":{"U1L1":"2026-11-01","U1L2":"2026-11-02","U2L1":""},"days":["2026-11-01","2026-11-02","2026-11-04"],"hearts":{"n":3,"msToNext":600000},"prefs":{"sound":false,"haptics":true,"soundStyle":"J"},"imported":{"g-1":"0a1b2c3d"}}'
D2='{"schema":1,"gen":1,"lineage":"lin-BBBB","xp":{"devC":50},"runs":{"devC":4},"done":{"U1L1":"2026-11-03"},"days":["2026-11-03"],"hearts":{"n":5,"msToNext":0},"prefs":{"sound":true,"haptics":true,"soundStyle":"J"},"imported":{}}'
D3='{"schema":1,"gen":1,"lineage":"lin-CCCC","xp":{},"runs":{},"done":{},"days":[],"hearts":{"n":5,"msToNext":0},"prefs":{"sound":true,"haptics":true,"soundStyle":"J"},"imported":{}}'
for pair in "$U1|$D1" "$U2|$D2" "$U3|$D3"; do
  u="${pair%%|*}"; d="${pair#*|}"; asu r3 "$u" "insert into public.progress(user_id,doc,rev) values ('$u','$d',1)" "commit" >/dev/null; done
asu r3 $U1 "select public.save_progress(1,'$(echo "$D1" | sed 's/"devA":120/"devA":150/')')" "commit" >/dev/null     # 旧版 U1 又保存一次：xp devA 120→150，rev 2
# 逐项快照：每个字段单独一份（按 user_id 排序），升级前后逐项对比
snap() { # snap <名字> <SQL 表达式>
  $SU -d r3 -c "select coalesce(string_agg(left(user_id::text,2) || '=' || ($2)::text, ' ; ' order by user_id), '') from public.progress"; }
declare -A FIELDS=( ["账号归属 user_id 与 auth.users 对应"]="user_id::text || (select email from auth.users u where u.id = user_id)" ["版本号 rev"]="rev" ["最后更新时间 updated_at"]="updated_at" ["数据格式版本 schema"]="doc->'schema'" ["代数 gen / lineage"]="(doc->'gen')::text || (doc->'lineage')::text" ["XP（各设备）xp"]="doc->'xp'" ["完成次数 runs"]="doc->'runs'" ["关卡 done（含完成日期）"]="doc->'done'" ["日期 days"]="doc->'days'" ["红心 hearts"]="doc->'hearts'" ["设置 prefs"]="doc->'prefs'" ["导入记录 imported"]="doc->'imported'" )
declare -A BEFORE
for f in "${!FIELDS[@]}"; do BEFORE[$f]=$(snap "$f" "${FIELDS[$f]}"); done
ok "R3.0 准备：旧版建了 3 行（U1 用旧版 save_progress 升到 rev 2，其 xp 从 120 改成 150）" "$([ "$($SU -d r3 -c "select count(*) from public.progress")" = "3" ] && [ "$(snap x rev)" = "11=2 ; 22=1 ; 33=1" ] && [ "$($SU -d r3 -c "select doc->'xp'->>'devA' from public.progress where user_id='$U1'")" = "150" ] && echo 1 || echo 0)" "$(snap x rev)"
r=$(asu r3 $U2 "update public.progress set rev = rev returning 'yes'"); ok "R3.1 升级前：旧版允许用户直接 UPDATE 自己的行（这是要被收回的）" "$([ "$r" = "yes" ] && echo 1 || echo 0)" "$r"
for round in 1 2; do
  $SU -d r3 -f "$SB/schema.sql" >/dev/null 2>&1
  same=1; bad=""
  for f in "${!FIELDS[@]}"; do now=$(snap "$f" "${FIELDS[$f]}"); if [ "$now" != "${BEFORE[$f]}" ]; then same=0; bad="$bad [$f]"; fi; done
  ok "R3.2.$round 第 $round 次运行 schema.sql 后，12 项逐项和升级前一致：账号归属、rev、updated_at、schema、gen/lineage、xp、runs、关卡 done 与完成日期、days、hearts、prefs、imported" "$same" "不一致：$bad"
done
ok "R3.2.3 两次升级后行数仍是 3，没有多出或少掉" "$([ "$($SU -d r3 -c "select count(*) from public.progress")" = "3" ] && echo 1 || echo 0)" ""
r=$($SU -d r3 -c "select string_agg(policyname||'/'||cmd, ',') from pg_policies where tablename='progress'"); ok "R3.3 旧的 INSERT/UPDATE 策略已删除，只剩 SELECT 策略" "$([ "$r" = "只读自己的进度/SELECT" ] && echo 1 || echo 0)" "$r"
r=$($SU -d r3 -c "select coalesce(string_agg(grantee||':'||privilege_type, ',' order by grantee, privilege_type), '') from information_schema.role_table_grants where table_name='progress' and grantee in ('anon','authenticated')"); ok "R3.4 表权限收窄为 authenticated:SELECT（anon 没有任何权限；TRUNCATE/TRIGGER/REFERENCES 也收回）" "$([ "$r" = "authenticated:SELECT" ] && echo 1 || echo 0)" "$r"
r=$(asu r3 $U1 "update public.progress set doc='{}'"); ok "R3.5 升级后：直接 UPDATE 被拒绝" "$(echo "$r" | grep -q 'permission denied' && echo 1 || echo 0)" "$r"
r=$(asu r3 $U1 "select rev || ' ' || doc::text from public.progress"); ok "R3.6 升级后 U1 读到自己的旧记录（rev 2，含关卡 U1L2 和 xp 150）" "$(echo "$r" | grep -q '^2 .*U1L2' && echo "$r" | grep -q '150' && echo 1 || echo 0)" "$r"
r=$(asu r3 $U1 "select public.save_progress(2,'{\"xp\":{\"d1\":160}}')" "commit"); ok "R3.7 升级后 U1 用旧记录的 rev=2 保存 → rev 3" "$([ "$r" = "3" ] && echo 1 || echo 0)" "$r"
r=$(asu r3 $U2 "select coalesce(public.create_progress('{\"overwrite\":1}')::text,'null')"); d=$($SU -d r3 -c "select doc::text from public.progress where user_id='$U2'")
ok "R3.8 升级后 U2 已有旧行：create_progress 返回 null，旧内容不被覆盖（doc 仍等于当初写入的 D2，rev 仍为 1）" "$([ "$r" = "null" ] && [ "$($SU -d r3 -c "select (doc = '$D2'::jsonb)::text || rev from public.progress where user_id='$U2'")" = "true1" ] && echo 1 || echo 0)" "$r $d"
r=$(asu r3 $U4 "select public.create_progress('{\"new\":1}')" "commit"); ok "R3.9 升级后：老账号 U4（没有旧行）第一次 create_progress → rev 1" "$([ "$r" = "1" ] && echo 1 || echo 0)" "$r"
asu r3 $U3 "select public.delete_my_account()" "commit" >/dev/null; r=$($SU -d r3 -c "select (select count(*) from auth.users where id='$U3') || '/' || (select count(*) from public.progress where user_id='$U3')")
ok "R3.10 升级后 U3 删号：账号和进度行都没了；其他人的行还在" "$([ "$r" = "0/0" ] && [ "$($SU -d r3 -c "select count(*) from public.progress")" = "3" ] && echo 1 || echo 0)" "$r"

echo; echo "合计 $((pass+fail)) 项，失败 $fail 项"; [ "$fail" = 0 ]
