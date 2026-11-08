// 测试入口构建时的“目标云项目”校验：配置错误就让构建失败，而不是静默变成“云端关闭”（到真机打开才发现）。
// 纯函数，输入是环境变量对象；vite.config.js 在构建开始时调用，测试也直接调用。不读密钥内容、不联网、不打印密钥。
//   宽松模式（默认）：只拦“一定是错的”——指向正式项目、网址解析不了、给了网址没给密钥（反之亦然）、拿了 secret / service_role 密钥。
//                      （自动测试会把测试云指向本机假服务器，所以默认不强制 *.supabase.co。）
//   严格模式（REQUIRE_TEST_CLOUD=1，测试预览的 CI 用）：必须 https://<20 位项目编号>.supabase.co；必须是公开密钥；
//                      设了 EXPECTED_TEST_PROJECT_REF 就必须与网址里的项目编号一致；没给云配置也失败；必须有 40 位源码提交号。
import { isProdUrl, hostOf } from "../src/cloud-config.js";

const b64json = (part) => { try { return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch { return null; } };
// 密钥只分类、不输出：publishable（sb_publishable_…）| anon-jwt（旧版 anon，role=anon）| secret | service-role | unknown
export function classifyKey(key) {
  const k = String(key || "").trim();
  if (!k) return { kind: "missing" };
  if (k.startsWith("sb_publishable_")) return { kind: "publishable" };
  if (k.startsWith("sb_secret_")) return { kind: "secret" };
  const parts = k.split(".");
  if (parts.length === 3) {
    const p = b64json(parts[1]);
    if (p && p.role === "service_role") return { kind: "service-role" };
    if (p && p.role === "anon") return { kind: "anon-jwt", ref: typeof p.ref === "string" ? p.ref : null };
  }
  return { kind: "unknown" };
}

export function checkPreviewCloud(env = {}) {
  const previewId = String(env.PREVIEW_ID || "").replace(/[^a-z0-9-]/gi, "");
  const url = String(env.TEST_SUPABASE_URL || "").trim();
  const key = String(env.TEST_SUPABASE_ANON_KEY || "").trim();
  const strict = env.REQUIRE_TEST_CLOUD === "1";
  const expectedRef = String(env.EXPECTED_TEST_PROJECT_REF || "").trim();
  const errors = [], notes = [];
  const info = { previewId, strict, mode: "prod-build", host: "", ref: "", keyKind: "none", cloud: "正式构建（不读测试云变量）" };
  if (!previewId) {
    if (url || key) notes.push("这是正式构建：TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY 被忽略。");
    if (strict) errors.push("REQUIRE_TEST_CLOUD=1 只能用于测试入口构建（需要 PREVIEW_ID）。");
    return { ok: errors.length === 0, errors, notes, info };
  }
  if (!url && !key) {
    info.mode = "cloud-off"; info.cloud = "关闭（没有给测试云配置）";
    if (strict) errors.push("严格模式要求连接测试云项目，但没有给 TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY。");
    return { ok: errors.length === 0, errors, notes, info };
  }
  if (!url) errors.push("给了 TEST_SUPABASE_ANON_KEY 但没有 TEST_SUPABASE_URL。");
  if (!key) errors.push("给了 TEST_SUPABASE_URL 但没有 TEST_SUPABASE_ANON_KEY。");
  const host = hostOf(url);
  if (url && !host) errors.push("TEST_SUPABASE_URL 解析不了（需要 http(s):// 开头的网址）。");
  else if (url && isProdUrl(url)) errors.push("TEST_SUPABASE_URL 指向正式 Supabase 项目——测试入口绝不允许连正式库。");
  const kk = classifyKey(key);
  if (kk.kind === "secret" || kk.kind === "service-role") errors.push("TEST_SUPABASE_ANON_KEY 是 secret / service_role 密钥——只能放公开密钥（sb_publishable_… 或旧版 anon）。");
  const ref = host.endsWith(".supabase.co") ? host.split(".")[0] : "";
  if (strict) {
    if (url && !/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/i.test(url)) errors.push("严格模式：TEST_SUPABASE_URL 必须是 https://<20 位项目编号>.supabase.co 的形式（不带路径、端口、用户信息）。");
    if (key && kk.kind !== "publishable" && kk.kind !== "anon-jwt") errors.push("严格模式：TEST_SUPABASE_ANON_KEY 不像公开密钥（需要 sb_publishable_… 或 role=anon 的旧版密钥）。");
    if (kk.kind === "anon-jwt" && kk.ref && ref && kk.ref !== ref) errors.push("密钥里的项目编号和网址里的项目编号不一致——这把密钥不是这个项目的。");
    if (expectedRef && ref !== expectedRef) errors.push(`网址里的项目编号（${ref || "无"}）不是期望的测试项目（EXPECTED_TEST_PROJECT_REF=${expectedRef}）。`);
    if (!expectedRef) notes.push("提示：没有设置 EXPECTED_TEST_PROJECT_REF，没法核对是不是 suipian-test。");
  }
  info.mode = errors.length ? "invalid" : "test-cloud"; info.host = host; info.ref = ref; info.keyKind = kk.kind; info.cloud = errors.length ? "配置有误" : `测试云项目 ${ref || host}`;
  return { ok: errors.length === 0, errors, notes, info };
}

// 源码提交号：显式环境变量 > CI 的 GITHUB_SHA > 本地 git（有未提交改动加 -dirty）> unknown。
export function resolveSourceSha(env = {}, gitSha = () => "") {
  const pick = [env.SOURCE_SHA, env.GITHUB_SHA].map((x) => String(x || "").trim()).find((x) => /^[0-9a-f]{40}$/i.test(x));
  if (pick) return pick.toLowerCase();
  const g = String(gitSha() || "").trim();
  return g || "unknown";
}
