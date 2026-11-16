// D：① CSP 只在构建时给了站点密钥时才放行 challenges.cloudflare.com（脚本 + 嵌入框架），别的指令不动；正式构建（无密钥）与以前逐字一致。
//    ② 人机验证失败的文案：不显示原文 / 错误码，不冷却，各类各有固定文案；已有 S1–S6 分类不被影响。
// 运行：node tests/captcha-csp-errors.test.mjs
import { CSP_DIRECTIVES, buildCsp, CAPTCHA_ORIGIN } from "../scripts/vite-csp-plugin.mjs";
import { classifySend, describeSendError, CAPTCHA_COPY, SEND_COPY } from "../src/auth-errors.js";
import { readFileSync } from "node:fs";

let ok = 0, bad = 0;
const check = (name, cond, detail = "") => { if (cond) ok++; else bad++; console.log(`${cond ? "✅" : "❌"} ${name}${!cond && detail ? "  — " + detail : ""}`); };

const H = ["sha256-AAAA"], CONNECT = ["https://proj.supabase.co"];
const off = CSP_DIRECTIVES(H, CONNECT, {}), on = CSP_DIRECTIVES(H, CONNECT, { captcha: true });
check("CSP 默认（不传 captcha）：不出现 cloudflare，也没有 frame-src", !off.join(";").includes("cloudflare") && !off.some((d) => d.startsWith("frame-src")));
check("CSP captcha:false 与不传完全相同", JSON.stringify(CSP_DIRECTIVES(H, CONNECT, { captcha: false })) === JSON.stringify(off));
const diff = on.filter((d) => !off.includes(d)), gone = off.filter((d) => !on.includes(d));
check("CSP 开启：只多出 script-src（加一个来源）和 frame-src，其余指令逐字不变", diff.length === 2 && gone.length === 1 && gone[0].startsWith("script-src") && diff.some((d) => d === `frame-src ${CAPTCHA_ORIGIN}`) && diff.some((d) => d.startsWith("script-src")), JSON.stringify({ diff, gone }));
const ss = on.find((d) => d.startsWith("script-src"));
check("CSP 开启：script-src 仍没有 unsafe-inline / unsafe-eval，来源只多了 challenges.cloudflare.com", !/'unsafe-(inline|eval)'/.test(ss) && ss === "script-src 'self' 'sha256-AAAA' https://challenges.cloudflare.com 'wasm-unsafe-eval'", ss);
check("CSP 开启：connect-src / default-src / form-action 不变（不放行 cloudflare 的连接）", on.find((d) => d.startsWith("connect-src")) === off.find((d) => d.startsWith("connect-src")) && !on.find((d) => d.startsWith("connect-src")).includes("cloudflare"));
check("CSP 来源是固定的 https://challenges.cloudflare.com，没有通配", CAPTCHA_ORIGIN === "https://challenges.cloudflare.com" && !on.join(";").includes("*"));
const html = `<html><head><meta charset="utf-8"><script>1</script></head></html>`;
check("buildCsp 透传 captcha 选项", buildCsp(html, { connect: CONNECT, captcha: true }).includes("frame-src https://challenges.cloudflare.com") && !buildCsp(html, { connect: CONNECT }).includes("cloudflare"));
// vite.config：密钥只对测试入口生效
const vc = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
check("vite.config：站点密钥只在 PREVIEW_ID（测试入口）非空时采用，正式构建为空", /const CAPTCHA_SITE_KEY = PREVIEW_ID \? RAW_CAPTCHA_KEY : ""/.test(vc) && /captcha: !!CAPTCHA_SITE_KEY/.test(vc) && /__CAPTCHA_SITE_KEY__: JSON\.stringify\(CAPTCHA_SITE_KEY\)/.test(vc));
check("vite.config：密钥格式不对 → 构建失败（不静默忽略）", /TEST_TURNSTILE_SITE_KEY 格式不对/.test(vc) && /throw new Error\("TEST_TURNSTILE_SITE_KEY/.test(vc));

// ---------- 错误文案 ----------
const RAW = "CANARY captcha verification process failed";
const cases = [
  [{ ok: false, kind: "captcha", reason: "unavailable" }, "K1"], [{ ok: false, kind: "captcha", reason: "timeout" }, "K2"], [{ ok: false, kind: "captcha", reason: "expired" }, "K2"],
  [{ ok: false, kind: "captcha", reason: "error", code: "300030" }, "K3"], [{ ok: false, kind: "captcha", reason: "busy" }, "K3"], [{ ok: false, kind: "captcha", reason: "cancelled" }, "K3"],
  [{ ok: false, kind: "auth", status: 400, errorCode: "captcha_failed", message: RAW }, "K4"],
];
for (const [r, id] of cases) {
  const d = describeSendError(r, { xp: 50 });
  check(`文案 ${JSON.stringify({ kind: r.kind, reason: r.reason, code: r.errorCode })} → ${id}：固定文案、不冷却、无诊断行、不含原文/错误码、有 XP 提示`, classifySend(r) === id && d.id === id && d.text === CAPTCHA_COPY[id].text() && d.cooldownMs === 0 && d.diag === "" && !d.text.includes("CANARY") && !d.text.includes("300030") && d.xp.includes("50 XP") && !d.uncertainSent, JSON.stringify(d));
}
check("K1–K4 文案互不相同", new Set(Object.values(CAPTCHA_COPY).map((e) => e.text())).size === 4);
check("K 类都说了“验证码没发出去”，不让人以为邮件发了", Object.values(CAPTCHA_COPY).every((e) => e.text().includes("验证码没发出去")));
// 不影响已有分类
const keep = [[{ ok: false, kind: "network", offline: true }, "S1a"], [{ ok: false, kind: "network" }, "S1b"], [{ ok: false, status: 429, errorCode: "over_email_send_rate_limit", retryAfterSec: 30 }, "S2"], [{ ok: false, status: 500 }, "S4"], [{ ok: false, status: 400, errorCode: "email_address_invalid" }, "S5"], [{ ok: false, status: 400, errorCode: "something_else" }, "S6"], [{ ok: false, kind: "config" }, "CFG"]];
for (const [r, id] of keep) check(`既有分类不变：${JSON.stringify(r)} → ${id}`, classifySend(r) === id);
check("意外异常（kind=unknown）走 S7：邮件可能已发出，不说“没发出去”，不冷却，不含原文", classifySend({ ok: false, kind: "unknown" }) === "S7" && describeSendError({ ok: false, kind: "unknown", message: "CANARY" }).cooldownMs === 0 && describeSendError({ ok: false, kind: "unknown", message: "CANARY" }).text === "暂时无法确认是否发出，请先检查邮件。" && !JSON.stringify(describeSendError({ ok: false, kind: "unknown", message: "CANARY" })).includes("CANARY"));
check("CAPTCHA_COPY 与 SEND_COPY 键不重叠", Object.keys(CAPTCHA_COPY).every((k) => !(k in SEND_COPY)));
console.log(`\n${ok} 通过，${bad} 失败`);
process.exit(bad ? 1 : 0);
