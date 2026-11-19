// 题库检查：同一道题的选项里，不能同时出现“同一个符号的全角 / 半角两种写法”（例如 ":" 和 "：" 并排）。
// 老大 2026-11-19 iPhone 实测反馈：两个不同输入法的冒号并排没有意义，一个就够。覆盖冒号、括号、引号、逗号、句号等常见符号。
// 判定：选项列表（tokens / options / choices 等任何“字符串列表”，排序题的 lines 除外——那里重复行是题目本身）里，
// 两个不同的选项经“全角→半角 + 去空格”归一后相同，且其中至少一个含全角 / 弯引号等符号 → 失败。只差空格的变体（如 "15杯" 与 "15 杯"）不算。
// 运行：node tests/content-fullwidth-dup.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const DIR = fileURLToPath(new URL("../content", import.meta.url));
const EXTRA = { "“": '"', "”": '"', "‘": "'", "’": "'", "。": ".", "、": ",", "「": "[", "」": "]" };
const FW = /[：；，。、（）［］｛｝＂＇“”‘’！？＝＋－＊／＜＞％＃＆＿｜～「」]/;
const norm = (x) => x.normalize("NFKC").replace(/[“”‘’。、「」]/g, (c) => EXTRA[c]).replace(/\s+/g, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

export function findDupes(root, file = "") {
  const bad = []; let lists = 0;
  const walk = (o, path) => {
    if (Array.isArray(o)) {
      if (o.length > 1 && o.every((x) => typeof x === "string")) {
        const name = path.split("/").pop();
        if (name !== "lines") { // 排序题的 lines 允许重复行
          lists++;
          const g = new Map();
          for (const x of o) { const k = norm(x); g.set(k, [...(g.get(k) || []), x]); }
          for (const xs of g.values()) { const u = [...new Set(xs)]; if (u.length > 1 && u.some((x) => FW.test(x))) bad.push(`${file}${path}：${u.map((x) => JSON.stringify(x)).join(" / ")}`); }
        }
      }
      o.forEach((v, i) => walk(v, `${path}[${i}]`));
    } else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, `${path}/${k}`);
  };
  walk(root, "");
  return { bad, lists };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let bad = [], lists = 0;
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) { const r = findDupes(JSON.parse(readFileSync(join(DIR, f), "utf8")), f); bad = bad.concat(r.bad); lists += r.lists; }
  check(`题库 ${files.length} 个文件、${lists} 个选项列表：没有同一符号的全角 / 半角重复选项`, bad.length === 0, bad.join("；"));
  // 判定本身的对照：这些构造的坏例子必须被抓到，只差空格的不能误报
  const probe = (o) => findDupes(o).bad.length;
  check("判定对照：[\":\", \"：\"] 被抓到", probe({ tokens: [":", "：", ";"] }) === 1);
  check("判定对照：括号 / 引号 / 逗号 / 句号的全角版本也被抓到", probe({ tokens: ["(", "（"] }) === 1 && probe({ options: ['"', "“"] }) === 1 && probe({ tokens: [",", "，"] }) === 1 && probe({ tokens: [".", "。"] }) === 1);
  check("判定对照：只差空格的选项（\"15杯\" / \"15 杯\"）和排序题 lines 的重复行不误报", probe({ tokens: ['"15杯"', '"15 杯"'] }) === 0 && probe({ lines: ["print(x)", "print(x)"] }) === 0 && probe({ tokens: [":", ";"] }) === 0);
  const failed = results.filter((x) => !x).length;
  console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
  process.exit(failed ? 1 : 0);
}
