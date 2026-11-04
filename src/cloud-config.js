// 云端（Supabase）连接配置：只放“项目网址”和“公开密钥（anon / publishable）”，这两样本来就会出现在网页里，靠数据库的行级权限保证安全。
// ⚠️ 绝不要把 service_role / secret 密钥、数据库密码写在这里或仓库的任何地方。
// 网址为空 = 云端功能未开通：应用仍可完全离线使用（游客模式），“我的”页里的登录入口会显示“云端暂未开通”。
const DEFAULT = { url: "https://aqlcunkmggzzvyavlkjg.supabase.co", anonKey: "sb_publishable_Ic9p2Y68XVralcZcAO8b6w_SjeEOIUJ" }; // 公开参数（前端本来就能看到）；绝不放 secret/service_role 密钥
// 测试入口（构建时设了 PREVIEW_ID）绝不连正式项目：只用构建时给的“测试项目”配置（TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY）；
// 没给 = 云端关闭（只能在本机学习）；给的网址就是正式项目 = 同样关闭。这样朋友们的正式数据不会被测试入口碰到。
const PROD_REF = "aqlcunkmggzzvyavlkjg";
// 解析网址取主机名（小写）；解析不了 = 空字符串。判断是不是正式项目一律看解析后的主机名，不看原始字符串（大小写、端口、用户信息、多余路径都不能绕过）。
export function hostOf(url) {
  try { const u = new URL(String(url)); return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase() : ""; } catch { return ""; }
}
export const PROD_HOST = hostOf(DEFAULT.url);
export function isProdUrl(url) {
  const h = hostOf(url);
  return !h || h === PROD_HOST || h.split(".")[0] === PROD_REF || h.includes(PROD_REF); // 解析不了的网址按“可能是正式”处理（拒绝）
}
function testCloud() {
  try {
    const t = typeof __TEST_CLOUD__ !== "undefined" ? __TEST_CLOUD__ : null;
    if (!t || typeof t.url !== "string" || typeof t.anonKey !== "string" || !t.url.trim() || !t.anonKey.trim()) return { url: "", anonKey: "" };
    if (isProdUrl(t.url.trim())) return { url: "", anonKey: "" };
    return { url: t.url.trim(), anonKey: t.anonKey.trim() };
  } catch { return { url: "", anonKey: "" }; }
}
const IS_PREVIEW = typeof __PREVIEW_ID__ !== "undefined" && !!__PREVIEW_ID__;
// 只有在本机（localhost / 127.0.0.1，自动测试用）才允许用浏览器里的设置覆盖；线上站点永远只用上面写死的配置。
function pick() {
  try {
    if (typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      const o = JSON.parse(localStorage.getItem("suipian.cloudConfig"));
      if (o && typeof o.url === "string" && typeof o.anonKey === "string") return { url: o.url, anonKey: o.anonKey };
    }
  } catch { /* 忽略 */ }
  return IS_PREVIEW ? testCloud() : DEFAULT;
}
export const CLOUD = pick();
