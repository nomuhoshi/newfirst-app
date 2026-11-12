// F：复制诊断里的“最近错误”只写操作阶段 + 异常类型，不写异常 message；旧记录诊断文件旁有分享前检查提示。
// 只用合成的假敏感字符串验证，不使用任何真实凭据。纯 node。
import { readFileSync } from "node:fs";
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const SECRET = "SYNTHETIC-SECRET-token=eyJabc123 user@example.invalid /private/path";
globalThis.window = {};
const feel = await import("../src/feel.js");
const mk = (name, msg = SECRET) => Object.assign(new Error(msg), name ? { name } : {});
ok("A1 errText：阶段 + 异常类型，不含 message", feel.errText("创建音频失败", mk("NotAllowedError")) === "创建音频失败（NotAllowedError）");
ok("A2 类型名不是普通标识符（含空格 / 符号 / 中文 / 过长）→ 未知类型", ["bad name", "x=1;token", "错误", "A".repeat(60)].every((n) => feel.errText("播放失败", mk(n)) === "播放失败（未知类型）"));
ok("A3 非 Error 的抛出值（字符串 / 数字 / null / undefined）→ 未知类型，且不含内容", [SECRET, 42, null, undefined].every((v) => feel.errText("试听失败", v) === "试听失败（未知类型）"));
ok("A4 name 本身被塞了敏感内容 → 不原样写出", !feel.errText("解锁失败", mk(SECRET)).includes("SYNTHETIC"));
// 真实代码路径：AudioContext 构造抛出带敏感 message 的异常 → 诊断里的 lastError
globalThis.window = { AudioContext: class { constructor() { throw mk("SecurityError"); } } };
feel.setPrefs({ sound: true });
feel.unlock(); feel.audioContext();
const d = feel.diagnostics();
ok("B1 真实路径（创建音频失败）：lastError = 阶段 + 类型", /^创建音频失败（SecurityError）$/.test(d.lastError), d.lastError);
ok("B2 诊断输出里没有任何合成敏感字符串", !JSON.stringify(d).match(/SYNTHETIC|token=|example\.invalid|\/private/), JSON.stringify(d));
const src = readFileSync(new URL("../src/feel.js", import.meta.url), "utf8");
ok("C1 feel.js 里 lastError 不再接收 e.message", !/lastError\s*=[^;]*\.message/.test(src) && !/e\?\.message/.test(src));
ok("C2 固定的状态历史仍在（创建:/→ 状态）", /stats\.history\.push\(`创建:/.test(src));
const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
ok("D1 诊断下载按钮旁有分享前检查提示（原文）", app.includes("诊断文件含旧记录原文，可能有私人信息。分享前请检查并脱敏，勿公开上传。") && /data-diagnostic-warning/.test(app));
ok("D2 提示只在有读不懂的旧记录时随按钮一起出现", /listUnreadable\(\)\.length \? h\("div", \{\}, h\("p"[\s\S]{0,700}data-export-diagnostic[\s\S]{0,300}data-diagnostic-warning/.test(app));
ok("D3 普通备份仍不带旧记录原文（unreadable: [] 路径未改）", /unreadable: diagnostic \? listUnreadable\(\) : \[\]/.test(app));
process.exit(fail ? 1 : 0);
