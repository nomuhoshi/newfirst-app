// 账号进度的本机存储：每个账号一份独立副本，按账号编号隔离；游客记录（suipian.progress）完全不碰。
// 所有函数都接收一个“像 localStorage 的对象”（getItem / setItem / removeItem），所以可以在 Node 里用假存储测试。
// 读写都包在 try/catch 里：存储被禁用或写满时返回失败，不抛错、不留下写了一半的内容。
import { normalizeDoc, docsEquivalent, isId, newId } from "./account-data.js";
import { HEARTS_MAX, HEART_REGEN_MS, regenHearts } from "./storage.js";

export const GUEST_KEY = "suipian.progress";      // 游客记录（storage.js 在用，这里只读，只有 clearGuestAfterVerified 一处会删）
export const GUEST_ID_KEY = "suipian.guestId";     // 这份游客记录的随机编号
export const DEVICE_KEY = "suipian.device";        // 这台设备的随机编号（浏览器数据被清除就会丢，丢了会生成新的）
export const SESSION_KEY = "suipian.session";      // 当前登录的账号编号（没有 = 游客）
const ACCT_PREFIX = "suipian.acct.";

// ---------- 按 Supabase 项目分开存 ----------
// 账号编号（user id）只在一个项目里唯一：两个项目里可能恰好有同一个编号（比如把正式库备份复制成测试库）。
// 所以“当前账号”“账号本机副本”“登录凭证”都带上项目标记：
//   正式项目（和以前一样）：沿用原来的键 suipian.session / suipian.acct.<编号> / suipian.auth，朋友们已有的存档一条不动；
//   其他项目（测试库、云端关闭）：用 suipian.proj.<项目主机名>.session / .acct.<编号> / .auth，和正式项目的互相看不见。
// 游客记录、游客编号、设备编号不分项目（它们不属于任何账号）。
export const projectScope = (projectId, legacyProject) => (projectId && projectId !== legacyProject ? String(projectId) : null);
export const projectKey = (scope, name) => `suipian.proj.${scope}.${name}`;
// 给账号存储套一层：当前账号 / 账号副本的键换成这个项目自己的；其他键原样放行。scope 为空 = 不换（正式项目 / 旧测试）。
export function scopedStorage(storage, scope) {
  if (!scope) return storage;
  const map = (k) => (k === SESSION_KEY ? projectKey(scope, "session") : typeof k === "string" && k.startsWith(ACCT_PREFIX) ? projectKey(scope, "acct." + k.slice(ACCT_PREFIX.length)) : k);
  return { getItem: (k) => storage.getItem(map(k)), setItem: (k, v) => storage.setItem(map(k), v), removeItem: (k) => storage.removeItem(map(k)) };
}

const acctKey = (userId) => ACCT_PREFIX + userId;

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
export const readGuestRaw = (storage) => { const r = safeRead(storage, GUEST_KEY); return r.ok ? r.value : null; };
// 区分：{ status:"none" } 没有游客记录；{ status:"read-failed" } 读取失败；{ status:"corrupt", raw } 记录损坏；{ status:"ok", raw, state }
export function readGuest(storage) {
  const r = safeRead(storage, GUEST_KEY);
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

// 退出登录：删除这个账号在本机的副本，回到游客。云端不动。
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
  const cur = safeRead(storage, GUEST_KEY);
  if (!cur.ok || cur.value !== guestSnapshotRaw) return false;
  return safeRemove(storage, GUEST_KEY);
}
