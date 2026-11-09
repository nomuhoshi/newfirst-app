// AUTH-MAIL-02 第 6 项：静态审计——账号 / 登录界面不会把服务器原文（英文）直接显示出来。
// 规则：src/account-ui.js 里，凡是传给 showToast / text: / textContent 的内容，不允许直接出现 “.message / .msg / error_description”，
//       必须经过 safeMessage / errorText / syncErrorText / describe*Error。
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/account-ui.js", import.meta.url), "utf8");
const lines = src.split("\n");
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };

const SAFE = /safeMessage\(|errorText\(|syncErrorText\(|describe(Send|Verify|Choice)Error\(|isOwnChinese\(/;
const offenders = [];
lines.forEach((ln, i) => {
  if (/^\s*\/\//.test(ln)) return;
  if (!/(showToast\(|\btext:|textContent|innerText|\.append\()/.test(ln)) return;
  if (/\b(?:r|f|q|res|e|err|s|x)\??\.(message|msg|error_description)\b/.test(ln) && !SAFE.test(ln)) offenders.push(`L${i + 1}: ${ln.trim().slice(0, 100)}`);
});
check("account-ui.js：没有把 .message 直接送进提示条 / 文本", offenders.length === 0, offenders.join(" | "));

// 所有 showToast 的字面量文案都含汉字（没有英文提示）
const lit = [...src.matchAll(/showToast\(\s*"([^"]+)"/g)].map((m) => m[1]);
const english = lit.filter((t) => !/[一-鿿]/.test(t));
check(`showToast 的 ${lit.length} 条字面量文案都是中文`, english.length === 0, english.join(" | "));

// 登录页上的按钮都有处理函数：button(label, handler, ...) 的 handler 不能是空
const emptyHandlers = [...src.matchAll(/button\(\s*"([^"]+)"\s*,\s*(?:\(\)\s*=>\s*\{\s*\}|null|undefined)/g)].map((m) => m[1]);
check("没有“点了没反应”的空按钮", emptyHandlers.length === 0, emptyHandlers.join(","));

// 会删数据的入口只有一个，并且必须经过确认弹窗（sheetConfirm）
const deleters = lines.map((ln, i) => [ln, i + 1]).filter(([ln]) => /sync\.deleteAccount\(/.test(ln));
const ctxOk = deleters.every(([, n]) => /sheetConfirm\(/.test(lines.slice(Math.max(0, n - 4), n).join("\n")));
check("删除账号只有 1 个入口，且在确认弹窗里", deleters.length === 1 && ctxOk, JSON.stringify(deleters.map((d) => d[1])));
const wipe = lines.map((ln, i) => [ln, i + 1]).filter(([ln]) => /localStorage\.(clear|removeItem)|storage\.removeItem|\.clear\(\)/.test(ln));
check("账号界面代码不直接清本机存储（进度只经 sync 的受保护函数改动）", wipe.length === 0, JSON.stringify(wipe.map((d) => d[1])));

// 选择游客进度的弹窗：必须有“稍后再说”，且“稍后”分支不调用 finishChoice
check("选择弹窗有「稍后再说」", /data-choice-later/.test(src));
const laterBlock = (src.match(/data-choice-later[\s\S]{0,400}/) || [""])[0];
check("「稍后再说」不调用 finishChoice（不会自动覆盖云端）", !/finishChoice/.test(laterBlock.split("\n").slice(0, 3).join("\n")), laterBlock.slice(0, 160));

console.log(`\n审计: ${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
