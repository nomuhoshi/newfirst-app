// 本机存储体检（只读诊断 + 申请持久存储）。所有函数都不抛错：存储被禁用、浏览器不支持时返回说明文字。
// 为什么需要：Safari 对长期不打开的网站会清理本机数据（主屏幕 App 不受影响）；无痕 / 私密浏览里每个标签的存储互相独立、关标签就清空。
// 用户看到的现象都是“进度没了”，必须能从诊断里区分这几种情况。
let persistText = "未检查";
export const persistLabel = () => persistText;

// 申请“持久存储”：浏览器批准后，不会因为空间紧张或长期不用被自动清理。Safari 对普通网页常常不批准（添加到主屏幕后更容易）。
export async function ensurePersist() {
  try {
    const st = navigator.storage;
    if (!st || typeof st.persist !== "function") { persistText = "浏览器不支持"; return persistText; }
    if (typeof st.persisted === "function" && (await st.persisted())) { persistText = "已持久"; return persistText; }
    persistText = (await st.persist()) ? "已持久" : "浏览器没有批准（长期不用可能被清理，请导出备份或添加到主屏幕）";
  } catch { persistText = "检查出错"; }
  return persistText;
}

const META_FIRST = "suipian.meta.firstSeen";
// 这份存储第一次被本应用使用的时间。关闭重开后如果“首次使用”变成了刚才，说明存储被清掉了 / 不是同一份存储。
export function firstSeenAt(now = Date.now()) {
  try {
    let v = Number(localStorage.getItem(META_FIRST));
    if (!v) { v = now; localStorage.setItem(META_FIRST, String(v)); }
    return v;
  } catch { return 0; }
}

export function localCounts() {
  let keys = 0, bytes = 0, v4 = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k) continue;
      keys++; bytes += k.length + (localStorage.getItem(k) || "").length;
      if (k.includes("suipian.v4.")) v4++;
    }
  } catch { return null; }
  return { keys, bytes, v4 };
}

const mb = (n) => (n / 1024 / 1024 >= 10 ? Math.round(n / 1024 / 1024) : Math.round((n / 1024 / 1024) * 10) / 10) + " MB";
export async function storageReport() {
  const lines = [];
  const fs = firstSeenAt();
  lines.push(`这份存储首次使用：${fs ? new Date(fs).toLocaleString() : "无法读取（存储不可用）"}`);
  const c = localCounts();
  lines.push(c ? `本机存储：${c.keys} 个键（学习记录相关 ${c.v4} 个），约 ${(c.bytes * 2 / 1024).toFixed(0)} KB` : "本机存储：读取失败");
  lines.push(`持久存储：${persistText}`);
  try {
    if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); lines.push(`浏览器存储额度：已用 ${mb(e.usage || 0)} / 共 ${mb(e.quota || 0)}`); }
  } catch { /* 忽略 */ }
  return lines;
}
