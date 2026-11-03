// 云端（Supabase）连接配置：只放“项目网址”和“公开密钥（anon / publishable）”，这两样本来就会出现在网页里，靠数据库的行级权限保证安全。
// ⚠️ 绝不要把 service_role / secret 密钥、数据库密码写在这里或仓库的任何地方。
// 网址为空 = 云端功能未开通：应用仍可完全离线使用（游客模式），“我的”页里的登录入口会显示“云端暂未开通”。
const DEFAULT = { url: "", anonKey: "" };
// 只有在本机（localhost / 127.0.0.1，自动测试用）才允许用浏览器里的设置覆盖；线上站点永远只用上面写死的配置。
function pick() {
  try {
    if (typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      const o = JSON.parse(localStorage.getItem("suipian.cloudConfig"));
      if (o && typeof o.url === "string" && typeof o.anonKey === "string") return { url: o.url, anonKey: o.anonKey };
    }
  } catch { /* 忽略 */ }
  return DEFAULT;
}
export const CLOUD = pick();
