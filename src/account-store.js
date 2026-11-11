// 账号进度的本机存储：每个账号一份独立副本，按账号编号隔离；游客记录（suipian.progress）完全不碰。
// 所有函数都接收一个“像 localStorage 的对象”（getItem / setItem / removeItem），所以可以在 Node 里用假存储测试。
// 读写都包在 try/catch 里：存储被禁用或写满时返回失败，不抛错、不留下写了一半的内容。
import { normalizeDoc, docsEquivalent, isId, newId, guestFingerprint } from "./account-data.js";
import { HEARTS_MAX, HEART_REGEN_MS, regenHearts, hasV4, guestRawV3, clearGuestV4 } from "./storage.js";

export const GUEST_KEY = "suipian.progress";      // 游客记录（storage.js 在用，这里只读，只有 clearGuestAfterVerified 一处会删）
export const GUEST_ID_KEY = "suipian.guestId";     // 这份游客记录的随机编号
export const DEVICE_KEY = "suipian.device";        // 这台设备的随机编号（浏览器数据被清除就会丢，丢了会生成新的）
export const SESSION_KEY = "suipian.session";      // 当前登录的账号编号（没有 = 游客）
const ACCT_PREFIX = "suipian.acct.";
export const PENDING_IMPORT_PREFIX = ACCT_PREFIX + "import."; // 游客导入写云失败后的专用待办（按账号分开，跟着 Supabase 项目命名空间走）

const acctKey = (userId) => ACCT_PREFIX + userId;
const pendingImportKey = (userId) => PENDING_IMPORT_PREFIX + userId;
const FP_RE = /^[0-9a-f]{8}$/;

// 读取结果区分三种情况：{ ok:true, value:null } 没有记录；{ ok:true, value } 有记录；{ ok:false } 读取失败（绝不能当成“没有记录”）
function safeRead(storage, key) { try { return { ok: true, value: storage.getItem(key) }; } catch { return { ok: false }; } }
function safeSet(storage, key, value) { try { storage.setItem(key, value); return true; } catch { return false; } }
function safeRemove(storage, key) { try { storage.removeItem(key); return true; } catch { return false; } }

// 返回 { ok:true, id } 或 { ok:false, code, message }。
// 读取失败、写不进去、写进去读回来不一致都明确返回失败，调用方不得用临时编号计 XP（否则每次打开换一个编号会重复计数）。
function getOrCreateId(storage, key) {
  const old = safeRead(storage, key);
  if (!old.ok) return { ok: false, code: "read-failed", message: "无法读取本机编号" };
  if (isId(old.value)) return { ok: true, id: old.value };
  const id = newId();
  if (!safeSet(storage, key, id)) return { ok: false, code: "save-failed", message: "无法保存本机编号（存储被禁用或已满）" };
  const back = safeRead(storage, key);
  if (!back.ok || back.value !== id) return { ok: false, code: "save-failed", message: "本机编号保存后读回不一致" };
  return { ok: true, id };
}
export const getDeviceId = (storage) => getOrCreateId(storage, DEVICE_KEY);
export const getGuestId = (storage) => getOrCreateId(storage, GUEST_ID_KEY);

// 原样读取游客记录的文本（不解析、不修改）
// v4 存储存在时，游客记录 = 完整的 v4 合并视图（旧格式文本）；视图不完整 / 读取失败时返回 { ok:false }，绝不当成“没有记录”
function readGuestSource(storage) {
  if (hasV4(storage)) { const raw = guestRawV3(storage); return raw === null ? { ok: false } : { ok: true, value: raw }; }
  return safeRead(storage, GUEST_KEY);
}
export const readGuestRaw = (storage) => { const r = readGuestSource(storage); return r.ok ? r.value : null; };
// 区分：{ status:"none" } 没有游客记录；{ status:"read-failed" } 读取失败；{ status:"corrupt", raw } 记录损坏；{ status:"ok", raw, state }
export function readGuest(storage) {
  const r = readGuestSource(storage);
  if (!r.ok) return { status: "read-failed" };
  if (r.value === null) return { status: "none" };
  try { const state = JSON.parse(r.value); if (state && typeof state === "object") return { status: "ok", raw: r.value, state }; } catch {}
  return { status: "corrupt", raw: r.value };
}

// ---------- 当前账号 ----------
export function getCurrentAccount(storage) {
  const r = safeRead(storage, SESSION_KEY);
  return r.ok && isId(r.value) ? r.value : null;
}
// 三态读取：{ ok:true, id } 有账号，{ ok:true, id:null } 确定没有账号，{ ok:false } 读取失败（抛错，或返回了既不是字符串也不是 null 的东西）。
// getCurrentAccount 把“读取失败”和“没有”折叠成同一个 null；要据此做不可恢复的事（如删凭证）的调用方必须用这个。
export function readCurrentAccount(storage) {
  const r = safeRead(storage, SESSION_KEY);
  if (!r.ok || (r.value !== null && typeof r.value !== "string")) return { ok: false };
  return { ok: true, id: isId(r.value) ? r.value : null };
}
export function setCurrentAccount(storage, userId) {
  if (userId === null) return safeRemove(storage, SESSION_KEY);
  return isId(userId) ? safeSet(storage, SESSION_KEY, userId) : false;
}

// ---------- 账号副本 ----------
// 副本的格式：{ doc, base, dirty }，base 是上次和云端同步时的云端版本号（给同步层用），dirty 记录红心 / 设置是否在上次同步后改过；content = 上次同步后学了新内容（XP、完成、日期）还没上传。
// 结果：{ ok:true, copy:null } 没有副本；{ ok:false, code:"read-failed" } 读取失败；{ ok:false, code:"corrupt" } 损坏。
// 读取失败和损坏时调用方不得当成空副本去覆盖（saveAccount 的 expectEmpty 会再挡一次）。
// 红心：保存时记下 savedAt（本机时间），读取时按经过的时间继续倒计时（用现有 regenHearts 规则），重新打开不会重置计时。
export function loadAccount(storage, userId, { now = Date.now() } = {}) {
  if (!isId(userId)) return { ok: false, code: "bad-user", message: "账号编号无效" };
  const r = safeRead(storage, acctKey(userId));
  if (!r.ok) return { ok: false, code: "read-failed", message: "无法读取这个账号的本机副本" };
  const raw = r.value;
  if (raw === null) return { ok: true, copy: null };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, code: "corrupt", message: "这个账号的本机副本损坏" }; }
  const n = normalizeDoc(parsed?.doc);
  if (!n.ok) return { ok: false, code: n.code, message: n.message };
  const doc = n.doc;
  if (Number.isFinite(parsed.savedAt) && now >= parsed.savedAt && doc.hearts.n < HEARTS_MAX) {
    const h = { hearts: doc.hearts.n, heartsAt: parsed.savedAt - (HEART_REGEN_MS - doc.hearts.msToNext) };
    const ms = regenHearts(h, now);
    doc.hearts = { n: h.hearts, msToNext: h.hearts >= HEARTS_MAX ? 0 : Math.round(ms) };
  }
  return { ok: true, copy: { doc, base: parsed.base ?? null, dirty: { hearts: !!parsed.dirty?.hearts, prefs: !!parsed.dirty?.prefs, content: !!parsed.dirty?.content } } };
}
// opts.expectEmpty：调用方以为“没有副本”时传 true；若此时读取失败或已经有内容，拒绝写入，避免把读不到的记录覆盖掉。
export function saveAccount(storage, userId, copy, { now = Date.now(), expectEmpty = false } = {}) {
  if (!isId(userId)) return false;
  if (expectEmpty) { const cur = safeRead(storage, acctKey(userId)); if (!cur.ok || cur.value !== null) return false; }
  const n = normalizeDoc(copy?.doc);
  if (!n.ok) return false;
  const payload = JSON.stringify({ doc: n.doc, base: copy.base ?? null, dirty: { hearts: !!copy.dirty?.hearts, prefs: !!copy.dirty?.prefs, content: !!copy.dirty?.content }, savedAt: now });
  return safeSet(storage, acctKey(userId), payload);
}
export function removeAccountCopy(storage, userId) {
  return isId(userId) ? safeRemove(storage, acctKey(userId)) : false;
}

// ---------- 游客导入的专用待办 ----------
// 用户已经做出选择（保留云端 / 安全合并），但指纹还没成功写入并读回时，不能只靠 doc.imported 或 dirty 猜。
// 这里单独按账号记一条：游客编号、选择、当时的指纹与游客原文快照。写云成功且读回一致后由同步层清掉。
// 失败时这条记录留在本机，重开页面 / 联网 / 手动同步都会先重试它，不会把“失败”当成“已完成”。
export function loadPendingImport(storage, userId) {
  if (!isId(userId)) return { ok: false, code: "bad-user", message: "账号编号无效" };
  const r = safeRead(storage, pendingImportKey(userId));
  if (!r.ok) return { ok: false, code: "read-failed", message: "无法读取游客导入待办" };
  return parsePendingImport(r.value, userId);
}
// 只解析、不读存储：同一段原文永远得到同一个判断（隔离流程要对“同一份原文”判断损坏，不能读两次各判一次）。
export function parsePendingImport(value, userId) {
  if (!isId(userId)) return { ok: false, code: "bad-user", message: "账号编号无效" };
  if (value === null) return { ok: true, record: null };
  let p;
  try { p = JSON.parse(value); } catch { return { ok: false, code: "corrupt", message: "游客导入待办损坏" }; }
  const ok = p && p.version === 1 && p.userId === userId && isId(p.guestId)
    && (p.choice === "cloud" || p.choice === "merge")
    && typeof p.fingerprint === "string" && FP_RE.test(p.fingerprint)
    && typeof p.guestRaw === "string" && p.guestState && typeof p.guestState === "object" && !Array.isArray(p.guestState);
  if (!ok) return { ok: false, code: "corrupt", message: "游客导入待办损坏" };
  // 指纹格式正确仍可能指向另一份游客进度。保留原文，拒绝把篡改快照当作已授权导入。
  let rawState;
  try { rawState = JSON.parse(p.guestRaw); } catch { return { ok: false, code: "corrupt", message: "游客导入待办损坏" }; }
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)
    || JSON.stringify(rawState) !== JSON.stringify(p.guestState)
    || guestFingerprint(p.guestState) !== p.fingerprint) {
    return { ok: false, code: "corrupt", message: "游客导入待办损坏" };
  }
  return { ok: true, record: { version: 1, userId, guestId: p.guestId, choice: p.choice, fingerprint: p.fingerprint, guestRaw: p.guestRaw, guestState: p.guestState, createdAt: Number.isFinite(p.createdAt) ? p.createdAt : 0 } };
}
export function savePendingImport(storage, userId, record) {
  if (!isId(userId) || !record || record.userId !== userId) return false;
  if (!isId(record.guestId) || (record.choice !== "cloud" && record.choice !== "merge")) return false;
  if (typeof record.fingerprint !== "string" || !FP_RE.test(record.fingerprint)) return false;
  if (typeof record.guestRaw !== "string" || !record.guestState || typeof record.guestState !== "object") return false;
  const payload = JSON.stringify({ version: 1, userId, guestId: record.guestId, choice: record.choice, fingerprint: record.fingerprint, guestRaw: record.guestRaw, guestState: record.guestState, createdAt: Number.isFinite(record.createdAt) ? record.createdAt : 0 });
  if (!safeSet(storage, pendingImportKey(userId), payload)) return false;
  const back = safeRead(storage, pendingImportKey(userId));
  return back.ok && back.value === payload;
}
export function clearPendingImport(storage, userId) {
  return isId(userId) ? safeRemove(storage, pendingImportKey(userId)) : false;
}

// ---------- 损坏导入待办的隔离备份 ----------
// 键：suipian.acct.quarantine.<账号>.<原文摘要>。以 "suipian.acct." 开头，所以在测试云项目里会和待办、账号副本一样带上项目命名空间前缀
// （sync.js 的 scopedStorage），换项目 / 换账号都不会碰到别人的备份。同一份原文永远落在同一个键上（可重复执行）；不同原文各有各的键，从不覆盖。
export const QUARANTINE_PREFIX = ACCT_PREFIX + "quarantine.";
export const quarantineKey = (userId, digest) => QUARANTINE_PREFIX + userId + "." + digest;
// 文本摘要：长度 + 两个不同种子的 32 位 FNV-1a。不是密码学哈希——只用来给“同一份原文”起名和比对身份；内容是否一致仍以逐字比较为准。
export function rawDigest(text) {
  const s = String(text);
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c ^ (i & 0xff), 0x01000193) >>> 0;
  }
  return s.length.toString(16) + "-" + a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
// 三态读取待办原文：{ ok:true, raw:null } 没有；{ ok:true, raw } 有（必须是字符串）；{ ok:false } 读不出来（抛错，或返回了不是字符串的东西）。
export function readPendingImportRaw(storage, userId) {
  if (!isId(userId)) return { ok: false };
  const r = safeRead(storage, pendingImportKey(userId));
  if (!r.ok || (r.value !== null && typeof r.value !== "string")) return { ok: false };
  return { ok: true, raw: r.value };
}
function parseBackup(text) { try { const e = JSON.parse(text); return e && typeof e === "object" ? e : null; } catch { return null; } }
// 把损坏原文备份进去并读回确认。返回 { ok:true, key, digest, reused } 或 { ok:false, code }。
//   同一份原文已经备份过（上次备份成功但后面一步失败）→ 直接复用；同一个键里是别的内容 → 拒绝，绝不覆盖。
export function backupCorruptPending(storage, userId, raw, { now = 0 } = {}) {
  if (!isId(userId) || typeof raw !== "string") return { ok: false, code: "bad-input" };
  const digest = rawDigest(raw), key = quarantineKey(userId, digest);
  const same = (text) => { const e = parseBackup(text); return !!e && e.version === 1 && e.kind === "pending-import" && e.userId === userId && e.digest === digest && e.raw === raw; };
  const existing = safeRead(storage, key);
  if (!existing.ok || (existing.value !== null && typeof existing.value !== "string")) return { ok: false, code: "read-failed" };
  if (existing.value !== null) return same(existing.value) ? { ok: true, key, digest, reused: true } : { ok: false, code: "backup-conflict" };
  const payload = JSON.stringify({ version: 1, kind: "pending-import", userId, digest, quarantinedAt: Number.isFinite(now) ? now : 0, raw });
  if (!safeSet(storage, key, payload)) return { ok: false, code: "backup-write-failed" };
  const back = safeRead(storage, key);
  if (!back.ok || typeof back.value !== "string" || !same(back.value)) return { ok: false, code: "backup-readback-failed" };
  return { ok: true, key, digest, reused: false };
}
// 读取某个账号、某个摘要对应的隔离备份（测试和人工恢复用）。
export function readQuarantineBackup(storage, userId, digest) {
  const r = safeRead(storage, quarantineKey(userId, digest));
  if (!r.ok || typeof r.value !== "string") return null;
  const e = parseBackup(r.value);
  return e && e.version === 1 && e.userId === userId && e.digest === digest ? e : null;
}

// 退出登录：删除这个账号在本机的副本，回到游客。云端不动。
// 注意：不删除“游客导入待办”。强制退出时它要留着，同账号再登录才能继续重试。
export function logoutLocal(storage, userId) {
  const a = removeAccountCopy(storage, userId);
  const b = setCurrentAccount(storage, null);
  return a && b;
}

// ---------- 游客记录：只有满足全部条件才允许清空 ----------
// 条件（docs/15 §5，缺一不可）：用户明确选择了“转存到账号”；上传成功；重新从云端读回来的内容和上传的一致。
// 另外：上传期间游客可能还在学习。必须传入上传时用的游客记录原文 guestSnapshotRaw，删除前和当前游客记录逐字比较，
// 不一致（或读不到）就保留本机记录。
// 其他任何情况（失败、超时、读回不一致、用户选的是云端进度）都保留游客记录。
export function clearGuestAfterVerified(storage, { userChoseTransfer, uploadOk, uploaded, readBack, guestSnapshotRaw }) {
  if (userChoseTransfer !== true || uploadOk !== true) return false;
  if (!readBack || !uploaded || !docsEquivalent(uploaded, readBack)) return false;
  if (typeof guestSnapshotRaw !== "string") return false;
  const cur = readGuestSource(storage);
  if (!cur.ok || cur.value !== guestSnapshotRaw) return false;
  const removed = safeRemove(storage, GUEST_KEY);
  if (removed && hasV4(storage)) clearGuestV4(storage); // v4 存储里的游客进度一并清除
  return removed;
}
