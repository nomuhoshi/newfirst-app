// U3 新题的内容核对（纯 Node，不需要浏览器）：用真实 python3 再跑一遍每道题，和 scripts/make-unit3.py 的核对互相独立。
// 选输出：正确项 = 真实输出；填空：正确词块 = 期望输出、错误词块都不是期望输出且有解释；排序：正确排列 = 全部排列里输出一致的；
// 结构：每关 4 题、每题有答案/错因/一句解释、“看懂 → 动手 → 换个例子”（选输出 → 填空/排序 → 选输出）、不含 emoji。
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const unit = JSON.parse(readFileSync(new URL("../content/unit3.json", import.meta.url), "utf8"));
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
const run = (code) => { const r = spawnSync("python3", ["-I", "-c", code], { encoding: "utf8", timeout: 10000 }); return r.status === 0 ? r.stdout.replace(/\n$/, "") : null; };
const perms = (n) => { const out = []; const go = (a, rest) => { if (!rest.length) out.push(a); rest.forEach((x, i) => go([...a, x], [...rest.slice(0, i), ...rest.slice(i + 1)])); }; go([], [...Array(n).keys()]); return out; };

check("U3 单元信息：id=U3、标题「比较与判断」", unit.id === "U3" && unit.title === "比较与判断");
for (const l of unit.lessons) {
  const T = `${l.id}「${l.title}」`;
  check(`${T}：4 题，题型顺序是 看懂(选输出) → 动手(填空/排序) → … → 换个例子(选输出)`, l.exercises.length === 4 && l.exercises[0].type === "predict" && l.exercises[3].type === "predict" && l.exercises.slice(1, 3).some((e) => e.type === "fill" || e.type === "order"), l.exercises.map((e) => e.type).join(","));
  check(`${T}：有故事、关键概念、示例代码，示例代码能真实运行`, !!l.story && !!l.concept && run(l.introCode) !== null);
  l.exercises.forEach((e, i) => {
    const N = `${l.id}#${i}（${e.type}）`;
    if (e.type === "predict") {
      const real = run(e.code), good = e.options.filter((o) => o.correct);
      check(`${N} 选输出：恰有 1 个正确项，且等于真实输出`, good.length === 1 && good[0].text === real, `真实=${JSON.stringify(real)}`);
      check(`${N} 选输出：每个选项都有一句解释，错误选项都不等于真实输出`, e.options.every((o) => o.why && o.why.length > 5) && e.options.filter((o) => !o.correct).every((o) => o.text !== real));
      check(`${N} 选输出：有提示条（一句简短解释）`, !!e.tip);
    } else if (e.type === "fill") {
      const sub = (t) => run(e.code.replace("{0}", t));
      check(`${N} 填空：正确词块的真实输出 = 期望输出`, sub(e.answer[0]) === e.expected, `真实=${JSON.stringify(sub(e.answer[0]))}`);
      const wrong = e.tokens.filter((t) => !e.answer.includes(t));
      check(`${N} 填空：${wrong.length} 个错误词块都不得到期望输出，且各有错因解释`, wrong.length >= 2 && wrong.every((t) => sub(t) !== e.expected && e.why[t]));
      check(`${N} 填空：有一句提示（hint）`, !!e.hint);
    } else {
      const valid = perms(e.lines.length).filter((p) => run(p.map((k) => e.lines[k]).join("\n")) === e.expected).map((p) => p.join());
      check(`${N} 排序：正确排列 = 全部 ${perms(e.lines.length).length} 种排列里真实输出一致的`, valid.sort().join("|") === e.answers.map((a) => a.join()).sort().join("|"), `真实=${valid.join("|")}`);
      check(`${N} 排序：初始排列是打乱的、不是答案；有提示`, e.shuffled.join() !== e.answers[0].join() && !!e.hint);
      // 不再用“存值 → 显示”的单一模板：至少一处改值后再比较，或有两次 print
      check(`${N} 排序：不是“存一个值再 print”的重复模板（至少 2 次 print）`, e.lines.filter((x) => x.startsWith("print")).length >= 2);
    }
  });
}
check("不含 emoji / 组合字符", !/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}‍️̀-ͯ]/u.test(JSON.stringify(unit)));
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
