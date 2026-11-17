// 填空词块 / 排序题初始排列的打乱（纯函数部分，不需要浏览器）。
// 背景：以前闯关里只有选输出题被打乱；填空题的正确词块（44/44 单空题）总在第 1 位，排序题的初始排列是写死的（同一关每次一样、偏向倒序）。
// 检查：
//   1. 全部课程里的每一道排序题：shuffleExercise 的结果绝不等于任一可接受答案（按“行文字”判，与 orderArea 判分一致）——逐题 N 次随机 + 对抗性随机数；
//   2. 打乱只是换位置：词块 / 行的集合不变，answer / answers / lines 等判分数据不变；
//   3. 填空题：单空题的正确词块在各位置大致均匀（不再总在第 1 位）；
//   4. 兜底：随机数永远给出“恒等排列”时，重抽 20 次后仍用相邻交换 / 反转 / 轮转选出“已验证错误”的排列，不死循环；
//      若一道题不存在任何错误排列（所有排列都算对），orderIsCorrect 兜底必须失败 → 本测试列出题目 ID，不把正确排列当作已修好；
//   5. 可注入随机数 → 同样的随机数序列得到同样的结果（稳定、可复现）。
// 运行：node tests/shuffle-fill-order.test.mjs
import { readFileSync } from "node:fs";
import { shuffleExercise, orderIsCorrect, shuffleOrderInitial, findWrongArrangement, ORDER_RETRIES, SHUFFLED_TYPES } from "../src/practice.js";

let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const course = JSON.parse(readFileSync(new URL("../content/course.json", import.meta.url)));
const all = [];
for (const u of course.units) { if (!u.available) continue; const d = JSON.parse(readFileSync(new URL(`../content/${u.file}`, import.meta.url))); for (const l of d.lessons) l.exercises.forEach((e, i) => all.push({ id: `${l.id}#${i + 1}`, ex: e })); }
const fills = all.filter((x) => x.ex.type === "fill"), orders = all.filter((x) => x.ex.type === "order");
console.log(`题库：填空 ${fills.length} 题，排序 ${orders.length} 题，共 ${all.length} 题`);
check("SHUFFLED_TYPES = 选输出 / 填空 / 排序", JSON.stringify(SHUFFLED_TYPES) === JSON.stringify(["predict", "fill", "order"]));

// 小型可复现随机数
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 1 + 2：逐题反例（每题 2000 次随机；再用“恒等”“恒反转”“恒 0.999…”三种对抗性随机数）
const N = 2000, bad = [], badSets = [], noWrong = [];
for (const { id, ex } of orders) {
  const rnd = mulberry(id.length * 7919);
  for (let t = 0; t < N; t++) { const s = shuffleExercise(ex, rnd);
    if (orderIsCorrect(ex, s.shuffled)) { bad.push(`${id}（随机第 ${t} 次）`); break; }
    if ([...s.shuffled].sort().join() !== [...ex.shuffled].sort().join() || JSON.stringify(s.answers) !== JSON.stringify(ex.answers) || JSON.stringify(s.lines) !== JSON.stringify(ex.lines)) { badSets.push(id); break; } }
  for (const [name, r] of [["恒0", () => 0], ["恒0.999", () => 0.999999], ["交替", (() => { let k = 0; return () => ((k++ % 2) ? 0.999999 : 0); })()]]) {
    const s = shuffleExercise(ex, r);
    if (orderIsCorrect(ex, s.shuffled)) bad.push(`${id}（对抗随机数 ${name}）`);
  }
  // 是否存在任何错误排列（不存在 = 题目本身有问题，兜底无法修）
  if (!findWrongArrangement(ex, ex.shuffled)) noWrong.push(id); // 不存在（或超过扫描上限）= 题库问题，列出题目 ID
}
check(`全部 ${orders.length} 道排序题 × ${N} 次随机 + 3 种对抗随机数：初始排列从不是正确答案`, bad.length === 0, bad.slice(0, 10).join("；"));
check("打乱只是换位置：行的集合、answers、lines 都没变", badSets.length === 0, badSets.join("、"));
check("没有“所有排列都算对”的排序题（兜底无法修这类题；有就列出题目 ID）", noWrong.length === 0, noWrong.join("、"));

// 3：填空
const pos = {}; let fillSetBad = [], fillTot = 0;
for (const { id, ex } of fills) { const rnd = mulberry(id.length * 104729);
  for (let t = 0; t < 600; t++) { const s = shuffleExercise(ex, rnd);
    if ([...s.tokens].sort().join("\u0001") !== [...ex.tokens].sort().join("\u0001") || JSON.stringify(s.answer) !== JSON.stringify(ex.answer)) { fillSetBad.push(id); break; }
    if (ex.answer.length === 1 && ex.tokens.length === 3) { const p = s.tokens.indexOf(ex.answer[0]); pos[p] = (pos[p] || 0) + 1; fillTot++; } } }
check("填空：词块集合与 answer 不变", fillSetBad.length === 0, fillSetBad.join("、"));
const ps = [0, 1, 2].map((k) => (pos[k] || 0) / fillTot);
check("填空（单空、3 词块）：正确词块在第 1/2/3 位的比例都接近 1/3（不再总在第 1 位）", ps.every((p) => p > 0.28 && p < 0.39), JSON.stringify(ps.map((p) => +p.toFixed(3))));

// 4：兜底路径
{ let calls = 0;
  const ident = { type: "order", lines: ["a", "b", "c"], shuffled: [0, 1, 2], answers: [[0, 1, 2]] };
  // 构造“随机永远命中答案”：rand 恒为 0.999…使 shuffle 恒等（j = i）→ 返回 [0,1,2]，重抽也一样
  const c = () => { calls++; return 0.999999; };
  const r = shuffleOrderInitial(ident, c);
  check("兜底：随机永远给出正确顺序时，重抽后用相邻交换 / 反转 / 轮转选出已验证错误的排列", !orderIsCorrect(ident, r) && [...r].sort().join() === "0,1,2", JSON.stringify(r));
  check("兜底：重抽次数有上限（不死循环）", calls <= ORDER_RETRIES * 3 + 5, `rand 调用 ${calls} 次`);
  // 交换前两项后仍是答案的例子：两个答案 [0,1,2] 与 [1,0,2]（前两项交换后仍对）
  const two = { type: "order", lines: ["a", "b", "c"], shuffled: [0, 1, 2], answers: [[0, 1, 2], [1, 0, 2]] };
  const r2 = shuffleOrderInitial(two, c);
  check("兜底：交换前两项后仍命中另一个可接受答案时，会继续换别的候选并再次核对", !orderIsCorrect(two, r2), JSON.stringify(r2));
  // 不存在错误排列：所有排列都算对（行文字全相同）
  const allOk = { type: "order", lines: ["x", "x"], shuffled: [0, 1], answers: [[0, 1]] };
  const r3 = shuffleOrderInitial(allOk, c);
  check("不存在错误排列的题：不死循环，如实返回仍为“正确”的结果；findWrongArrangement 返回 null（逐题检查据此列出题目 ID）", orderIsCorrect(allOk, r3) === true && findWrongArrangement(allOk, [0, 1]) === null);
  // 四行反例（产品官6号）：answers 列出当前排列 + 全部相邻交换 / 反转 / 轮转候选，仍保留其它错误排列；随机数恒命中正确排列 → 最终必须选到错误排列
  const four = { type: "order", lines: ["a = 1", "b = 2", "c = 3", "print(a, b, c)"], shuffled: [0, 1, 2, 3], answers: [[0, 1, 2, 3], [1, 0, 2, 3], [0, 2, 1, 3], [0, 1, 3, 2], [3, 2, 1, 0], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]] };
  const r4 = shuffleOrderInitial(four, c);
  check("四行反例：重抽和全部兜底候选（相邻交换 / 反转 / 轮转）都是可接受答案时，遍历其余排列选到已验证错误的排列", !orderIsCorrect(four, r4) && [...r4].sort().join() === "0,1,2,3", JSON.stringify(r4));
  check("四行反例：24 个排列里恰有 8 个可接受答案，仍存在错误排列（反例成立）", findWrongArrangement(four, [0, 1, 2, 3]) !== null);
  const ex4 = shuffleExercise(four, c);
  check("四行反例（经 shuffleExercise）：同样选到错误排列，判分数据不变", !orderIsCorrect(ex4, ex4.shuffled) && JSON.stringify(ex4.answers) === JSON.stringify(four.answers));
}

// 5：可复现 / 其它题型不动
{ const e = orders[0].ex; const a = shuffleExercise(e, mulberry(5)), b = shuffleExercise(e, mulberry(5)); check("同一随机数序列 → 同一结果（可注入、可复现）", JSON.stringify(a) === JSON.stringify(b)); }
{ const code = { type: "code", prompt: "p", expected: "1" }; check("不在列表里的题型（写代码题等）shuffleExercise 不改内容", JSON.stringify(shuffleExercise(code)) === JSON.stringify(code)); }
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
