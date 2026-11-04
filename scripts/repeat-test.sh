#!/bin/bash
# 重复跑某个测试 N 次，记录每次的退出码和耗时、失败数；用来排查偶发失败。
# 用法：npm run build && scripts/repeat-test.sh tests/step3.test.mjs 20
# 想加压力：另开几个终端跑  for k in 1 2 3 4; do (timeout 600 sh -c 'while :; do :; done' &); done
t="${1:?用法: scripts/repeat-test.sh <测试文件> [次数]}"; n="${2:-10}"; fails=0
for i in $(seq 1 "$n"); do
  s=$(date +%s); out=$(node "$t" 2>&1); ec=$?; e=$(date +%s)
  echo "第 $i 次 退出码=$ec 耗时=$((e - s))s ✅=$(grep -c '✅' <<<"$out") ❌=$(grep -c '❌' <<<"$out")"
  if [ "$ec" != 0 ]; then fails=$((fails + 1)); grep -E "❌|刷新诊断|Timeout|TimeoutError" <<<"$out" | head -5; fi
done
echo "共 $n 次，失败 $fails 次"; [ "$fails" = 0 ]
