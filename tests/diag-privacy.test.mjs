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

// 人机验证最近一次失败（原因 + 过滤后的错误码）进复制诊断；不进页面文字
const cap = readFileSync(new URL("../src/captcha.js", import.meta.url), "utf8");
const acc = readFileSync(new URL("../src/account-ui.js", import.meta.url), "utf8");
const authErr = readFileSync(new URL("../src/auth-errors.js", import.meta.url), "utf8");
ok("E1 复制诊断里有人机验证最近失败这一行，来自 captchaDiagLine()", /import \{ captchaDiagLine \} from "\.\/captcha\.js"/.test(app) && /\n\s*captchaDiagLine\(\),/.test(app));
ok("E2 错误码只经 safeCode 白名单进记录（字母数字 / 下划线 / 连字符，1–24 位），记录里没有令牌或原文字段", /const rec = \(r\) => \{[^}]*lastFailure = \{ reason: r\.reason, \.\.\.\(r\.code \? \{ code: r\.code \} : \{\}\) \}/.test(cap) && /SAFE_CODE = \/\^\[0-9a-zA-Z_-\]\{1,24\}\$\//.test(cap));
ok("E3 页面文字（account-ui / auth-errors）不引用错误码记录：错误码只在复制诊断里", !/getLastCaptchaFailure|captchaDiagLine|lastFailure/.test(acc) && !/getLastCaptchaFailure|captchaDiagLine|lastFailure/.test(authErr));

// Service Worker 注册失败同样进入复制诊断的“离线支持”行，不能原样拼接 message。
const { swRegistrationError } = await import("../src/sw-diagnostics.js");
const { runInNewContext } = await import("node:vm");
const SW_SECRET = "FAKE_SW_TOKEN_123 user@example.invalid https://example.invalid/sw.js?access_token=TEST#private";
const swError = (name) => Object.assign(new Error(SW_SECRET), { name });
ok("E1 注册错误：保留 TypeError 类别，不输出 message", swRegistrationError(swError("TypeError")) === "注册失败（TypeError）");
ok("E2 注册错误：保留 SecurityError 类别，不输出资源 URL", swRegistrationError(swError("SecurityError")) === "注册失败（SecurityError）");
ok("E3 自定义 / 过长 / 非字符串 name 均显示未知类型", [SW_SECRET, "FAKE_SW_TOKEN_WITHOUT_PUNCTUATION", "A".repeat(5000), {}].every((name) => swRegistrationError(swError(name)) === "注册失败（未知类型）"));
ok("E4 非异常抛出值不转换为诊断文本", [SW_SECRET, null, undefined, 42].every((error) => swRegistrationError(error) === "注册失败（未知类型）"));
const badName = Object.defineProperty({}, "name", { get() { throw new Error(SW_SECRET); } });
ok("E5 name getter 抛错时仍返回固定说明", swRegistrationError(badName) === "注册失败（未知类型）");
const badMessage = Object.defineProperty({ name: "TypeError" }, "message", { get() { throw new Error("message must not be read"); } });
ok("E6 注册错误格式化不读取 message", swRegistrationError(badMessage) === "注册失败（TypeError）");

// 在 Node 隔离环境中执行 app.js 的实际 register 声明与实际诊断行；不模拟 formatter 的实现。
// 这不是完整页面 / 剪贴板 / 浏览器执行，浏览器 CI 和真机证据仍独立记录。
const registerLine = app.split("\n").find((line) => /^\s*const register = \(\) => navigator\.serviceWorker\.register\(/.test(line));
const offlineLine = app.split("\n").find((line) => line.includes("`离线支持：${swInfo.status}`")).trim().replace(/,$/, "");
async function registrationScene(error, success = false) {
  const calls = [], registration = { waiting: null };
  const context = {
    swInfo: { status: "未启用" }, swReg: null, swRegistrationError,
    navigator: { serviceWorker: { async register(url) { calls.push(["register", url]); if (!success) throw error; return registration; } } },
    watchUpdate: (reg) => calls.push(["watchUpdate", reg === registration]),
    refreshSwInfo: () => calls.push(["refreshSwInfo"]),
  };
  await runInNewContext(`${registerLine}\nregister();`, context, { timeout: 1000 });
  return { context, calls, text: runInNewContext(offlineLine, context, { timeout: 1000 }) };
}
for (const name of ["TypeError", "SecurityError"]) {
  const failure = await registrationScene(swError(name));
  ok(`F app.js 真实注册失败路径：诊断保留 ${name}，不带假私人文本`, failure.text === `离线支持：注册失败（${name}）` && !/FAKE_SW|example\.invalid|access_token=/.test(failure.text) && JSON.stringify(failure.calls) === JSON.stringify([["register", "./sw.js"]]), failure.text);
}
const unsafeFailure = await registrationScene(SW_SECRET);
ok("F app.js 抛出字符串时诊断仍不带原文", unsafeFailure.text === "离线支持：注册失败（未知类型）", unsafeFailure.text);
const success = await registrationScene(null, true);
ok("F app.js 注册成功仍保存 registration、监听更新并刷新状态", !!success.context.swReg && JSON.stringify(success.calls) === JSON.stringify([["register", "./sw.js"], ["watchUpdate", true], ["refreshSwInfo"]]), JSON.stringify(success.calls));
process.exit(fail ? 1 : 0);
