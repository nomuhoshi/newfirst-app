// 本机存储体检（只读诊断 + 申请持久存储）。所有函数都不抛错：存储被禁用、浏览器不支持时返回说明文字。
// 为什么需要：Safari 对长期不打开的网站会清理本机数据（主屏幕 App 不受影响）；无痕 / 私密浏览里每个标签的存储互相独立、关标签就清空。
// 用户看到的现象都是“进度没了”，必须能从诊断里区分这几种情况。
import { currentEpoch, DEFAULT_EPOCH } from "./storage.js";
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
  const lh = loadHistory();
  lines.push(lh === null ? "打开记录：读取失败" : `本标签页所在存储里的打开次数：${lh.length}${lh.length >= 8 ? "（只保留最近 8 次）" : ""}${lh.length ? `；最近：${lh.slice(-3).map((x) => new Date(x).toLocaleString()).join(" / ")}` : ""}`);
  lines.push(...await browserProbe());
  try {
    if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); lines.push(`浏览器存储额度：已用 ${mb(e.usage || 0)} / 共 ${mb(e.quota || 0)}`); }
  } catch { /* 忽略 */ }
  return lines;
}

// ---- 14 天导出提醒（Fable 审计 A）----
// 本机记录只存在这台设备的浏览器里；Safari 可能清理长期不用的网站数据。每隔 14 天轻轻提醒一次导出进度文件。
// 非阻塞、只在地图页显示一条可关闭的提示，不弹系统通知、不在答题中出现；导出成功后重新计时；点“稍后”3 天内不再提示。
// 已登录账号的记录在云端，不提醒。持久存储的结果如实显示在诊断里，这里不承诺“永久不丢”。
const META_BASE = "suipian.meta.backupBase"; // 备份提醒起算点：首次成功保存有效学习进度（或升级时已有进度）的时间
// 注意：旧版（#68 `57793a2`）点下载就写 suipian.meta.lastExport，没经用户确认——新版不再把它当确认凭据，改用独立的 confirmedExport
const META_EXPORT = "suipian.meta.confirmedExport", META_SNOOZE = "suipian.meta.exportSnooze";
// 提醒记录按“代数”隔离：用户明确清除学习记录后是新的一代，重新计时；旧代的确认 / 稍后 / 起点记录原样保留（不删除），但不再影响新一代。
// 从没清除过（代数 m0）继续用原来的键，老用户的记录不需要迁移；读不到代数时当作没有记录、不写。
const mk = (base) => { const e = currentEpoch(); return e === null ? null : e === DEFAULT_EPOCH ? base : base + "." + e; };
export const EXPORT_EVERY_MS = 14 * 24 * 3600 * 1000, EXPORT_SNOOZE_MS = 3 * 24 * 3600 * 1000, EXPORT_MIN_LESSONS = 3;
export function ensureBackupBase(doneCount, now = Date.now()) {
  try { const k = mk(META_BASE); if (!k) return 0; if (doneCount > 0 && !localStorage.getItem(k)) localStorage.setItem(k, String(now)); return Number(localStorage.getItem(k)) || 0; } catch { return 0; }
}
export function backupBaseAt() { try { const k = mk(META_BASE); return k ? Number(localStorage.getItem(k)) || 0 : 0; } catch { return 0; } }
export function markExported(now = Date.now()) { try { const k = mk(META_EXPORT), z = mk(META_SNOOZE); if (!k || !z) return false; localStorage.setItem(k, String(now)); localStorage.removeItem(z); return true; } catch { return false; } }
export function snoozeExport(now = Date.now()) { try { const k = mk(META_SNOOZE); if (!k) return false; localStorage.setItem(k, String(now + EXPORT_SNOOZE_MS)); return true; } catch { return false; } }
export function lastExportAt() { try { const k = mk(META_EXPORT); return k ? Number(localStorage.getItem(k)) || 0 : 0; } catch { return 0; } }
export function exportReminderDue({ now = Date.now(), doneCount = 0, signedIn = false } = {}) {
  try {
    if (signedIn || doneCount < EXPORT_MIN_LESSONS) return false;
    const ref = lastExportAt() || backupBaseAt(); // 从没确认备份过：从首次成功保存进度（升级用户从升级那次）算起；还没有起点就不提醒
    if (!ref || now - ref < EXPORT_EVERY_MS) return false;
    const sk = mk(META_SNOOZE); const snooze = sk ? Number(localStorage.getItem(sk)) || 0 : 0;
    return now >= snooze;
  } catch { return false; }
}

// ---- 打开记录与浏览器存储探针（Safari 进度丢失定位用）----
// 每次打开记一次时间（最多留 8 条）。老大下次点“复制诊断”就能看出：关掉再打开后“打开次数”是 1 还是在累加——
// 1 = 这个标签页的本机存储没有保留（无痕 / 每个标签独立 / 被清）；累加 = 存储在，问题在别处。
const META_LOADS = "suipian.meta.loads";
export function recordLoad(now = Date.now()) {
  try {
    let arr = []; try { const a = JSON.parse(localStorage.getItem(META_LOADS) || "[]"); if (Array.isArray(a)) arr = a.filter((x) => Number.isFinite(x)); } catch { /* 坏了就重新记 */ }
    arr.push(now); arr = arr.slice(-8);
    localStorage.setItem(META_LOADS, JSON.stringify(arr));
    return arr;
  } catch { return null; }
}
export function loadHistory() { try { const a = JSON.parse(localStorage.getItem(META_LOADS) || "[]"); return Array.isArray(a) ? a.filter((x) => Number.isFinite(x)) : []; } catch { return null; } }
export async function browserProbe() {
  const out = [];
  const t = (f) => { try { return f(); } catch (e) { return "出错：" + (e && e.name || "未知"); } };
  out.push(`Cookie：${t(() => (navigator.cookieEnabled ? "允许" : "被阻止"))}`);
  out.push(`localStorage 写入：${t(() => { const k = "suipian.meta.probe"; localStorage.setItem(k, "1"); const ok = localStorage.getItem(k) === "1"; localStorage.removeItem(k); return ok ? "正常" : "写入后读不回"; })}`);
  out.push(`sessionStorage：${t(() => { sessionStorage.setItem("suipian.probe", "1"); const ok = sessionStorage.getItem("suipian.probe") === "1"; sessionStorage.removeItem("suipian.probe"); return ok ? "正常" : "读不回"; })}`);
  out.push(`IndexedDB：${await new Promise((res) => { try { if (!globalThis.indexedDB) return res("不支持"); const r = indexedDB.open("suipian-probe"); r.onsuccess = () => { try { r.result.close(); indexedDB.deleteDatabase("suipian-probe"); } catch { /* 忽略 */ } res("可用"); }; r.onerror = () => res("被拒绝（" + (r.error && r.error.name || "未知") + "）"); r.onblocked = () => res("被阻塞"); setTimeout(() => res("无响应"), 1500); } catch (e) { res("出错：" + (e && e.name || "未知")); } })}`);
  return out;
}
