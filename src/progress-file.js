// 学习进度文件：导出 / 导入。零成本的自救办法——浏览器数据被清、手机换了、云端连不上时，用户手里有一份自己的备份。
// 纯函数，不碰 DOM、不碰 localStorage，方便测试。
// 导入的规则：只“合并”，不“覆盖”——完成的关卡取并集，XP 取较大者，永远不会让现有进度变少。
import { DATA_VERSION, HEARTS_MAX } from "./storage.js";

export const FILE_FORMAT = "suipian-progress";
export const FILE_VERSION = 1;
export const MAX_FILE_BYTES = 1024 * 1024; // 1MB：真实进度文件只有几 KB，更大的一定不是我们导出的

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isInt = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;

export function exportFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `suipian-progress-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

function pickProgress(st) {
  const s = st || {};
  const done = {}; for (const [k, v] of Object.entries(s.done || {})) if (v === true && ID_RE.test(k) && k !== "__proto__") done[k] = true;
  const doneOn = {}; for (const [k, v] of Object.entries(s.doneOn || {})) if (done[k] && typeof v === "string" && realDay(v)) doneOn[k] = v;
  return { version: s.version ?? DATA_VERSION, xp: s.xp, lessonsCompleted: s.lessonsCompleted ?? 0, streak: s.streak, lastDay: s.lastDay ?? null, done, doneOn };
}
// 真实日历日期（2026-02-31 不合法）
function realDay(v) { if (typeof v !== "string" || !DAY_RE.test(v)) return false; const [y, m, d] = v.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; }

// 导出内容：当前进度 + （如果有）读不懂而被留下来的旧记录原文，一起带走
export function buildExport(state, { now = Date.now(), build = "", unreadable = [] } = {}) {
  return {
    format: FILE_FORMAT,
    exportVersion: FILE_VERSION,
    exportedAt: new Date(now).toISOString(),
    build: String(build || ""),
    state: pickProgress(state), // 字段白名单：只带进度，不带偏好、红心、旧记录里的未知字段（可能含诊断或凭证）
    unreadable: unreadable.map((u) => ({ savedAt: u.savedAt, raw: u.raw })),
  };
}

// 检查导入文件。返回 { ok: true, state, exportedAt } 或 { ok: false, error }
export function parseImport(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "文件是空的。" };
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: "文件太大，不像是从碎片编程导出的进度文件。" };
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, error: "文件内容不是有效的进度文件（无法读取）。" }; }
  if (!obj || typeof obj !== "object" || obj.format !== FILE_FORMAT) return { ok: false, error: "这不是碎片编程的进度文件。" };
  if (obj.exportVersion !== FILE_VERSION) return { ok: false, error: "这个进度文件来自不同版本，当前版本不认识，没有导入任何内容。" };
  const s = obj.state;
  if (!s || typeof s !== "object" || s.version !== DATA_VERSION) return { ok: false, error: "进度文件里的学习记录格式不对，没有导入任何内容。" };
  if (!isInt(s.xp, 10_000_000) || !isInt(s.streak, 100_000) || !isInt(s.lessonsCompleted ?? 0, 10_000_000)) return { ok: false, error: "进度文件里的数字不合理，没有导入任何内容。" };
  if (s.lastDay != null && !realDay(s.lastDay)) return { ok: false, error: "进度文件里的日期不合理，没有导入任何内容。" };
  if (!s.done || typeof s.done !== "object" || Array.isArray(s.done)) return { ok: false, error: "进度文件里缺少关卡完成记录，没有导入任何内容。" };
  const done = {};
  for (const [k, v] of Object.entries(s.done)) {
    if (!ID_RE.test(k) || k === "__proto__") return { ok: false, error: "进度文件里有不合法的关卡编号，没有导入任何内容。" };
    if (v === true) done[k] = true;
  }
  return {
    ok: true,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : null,
    state: { xp: s.xp, streak: s.streak, lastDay: s.lastDay ?? null, done, lessonsCompleted: s.lessonsCompleted ?? 0 },
  };
}

// 合并：done 并集；XP、完成次数取较大；连续天数跟着“最后学习日期较新”的一边（同一天取较大）；
// 红心、偏好、音效设置全部沿用当前设备的（文件里的这些不重要，也不该覆盖现在的选择）
export function mergeImport(current, imported) {
  const done = { ...current.done };
  for (const k of Object.keys(imported.done)) done[k] = true;
  const a = current.lastDay, b = imported.lastDay;
  let streak = current.streak, lastDay = a;
  if (b && (!a || b > a)) { streak = imported.streak; lastDay = b; }
  else if (b && a === b) streak = Math.max(current.streak, imported.streak);
  return {
    ...current,
    onboarded: true,
    xp: Math.max(current.xp, imported.xp),
    lessonsCompleted: Math.max(current.lessonsCompleted || 0, imported.lessonsCompleted || 0),
    done, streak, lastDay,
    hearts: Math.min(HEARTS_MAX, current.hearts),
  };
}

// 给用户看的摘要
export function summarize(s) {
  return { xp: s.xp, lessons: Object.keys(s.done).length, streak: s.streak, lastDay: s.lastDay };
}

// ---- 进度码：把进度文件压成一段可复制粘贴的文字（Safari 标签页 ↔ 主屏幕 App ↔ 新标签页之间转移用，不依赖“文件”App）----
// 格式：SPC1. + base64url(进度文件 JSON，不含旧坏记录原文)。粘贴时忽略空白和换行（微信 / 备忘录常常会插入）。
export const CODE_PREFIX = "SPC1.";
// 完整性校验：FNV-1a 32 位。防的是复制时被截断、被聊天软件改字，不是防恶意伪造（恶意构造的码也只能走和文件导入一样的合并规则，不会让进度变少）
function checksum(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }
const b64 = (bytes) => { let bin = ""; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
export function encodeCode(state, { now = Date.now(), build = "" } = {}) {
  const json = JSON.stringify(buildExport(state, { now, build, unreadable: [] }));
  const body = b64(new TextEncoder().encode(json));
  return CODE_PREFIX + body + "." + checksum(body);
}
// 返回 { ok:true, text } 或 { ok:false, error }；text 交给 parseImport 做全部校验
export function decodeCode(input) {
  const raw = typeof input === "string" ? input.replace(/\s+/g, "") : "";
  if (!raw) return { ok: false, error: "还没有粘贴进度码。" };
  const i = raw.indexOf(CODE_PREFIX);
  if (i < 0) return { ok: false, error: "这不是碎片编程的进度码（应以 SPC1. 开头）。" };
  const rest = raw.slice(i + CODE_PREFIX.length), dot = rest.lastIndexOf(".");
  const bodyUrl = dot < 0 ? rest : rest.slice(0, dot), sum = dot < 0 ? "" : rest.slice(dot + 1);
  if (!sum || !/^[0-9a-f]{8}$/.test(sum) || checksum(bodyUrl) !== sum) return { ok: false, error: "进度码不完整或被改动过（校验不通过），请重新复制整段。" };
  const body = bodyUrl.replace(/-/g, "+").replace(/_/g, "/");
  if (!body || body.length > MAX_FILE_BYTES * 2 || !/^[A-Za-z0-9+/]+$/.test(body)) return { ok: false, error: "进度码不完整或被改动过，请重新复制整段。" };
  try {
    const bin = atob(body + "=".repeat((4 - (body.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch { return { ok: false, error: "进度码不完整或被改动过，请重新复制整段。" }; }
}
