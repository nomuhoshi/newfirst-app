// 账号进度的本机存储：每个账号一份独立副本，按账号编号隔离；游客记录（suipian.progress）完全不碰。
// 所有函数都接收一个“像 localStorage 的对象”（getItem / setItem / removeItem），所以可以在 Node 里用假存储测试。
// 读写都包在 try/catch 里：存储被禁用或写满时返回失败，不抛错、不留下写了一半的内容。
import { normalizeDoc, docsEquivalent, isId, newId } from "./account-data.js";

export const GUEST_KEY = "suipian.progress";      // 游客记录（storage.js 在用，这里只读，只有 clearGuestAfterVerified 一处会删）
export const GUEST_ID_KEY = "suipian.guestId";     // 这份游客记录的随机编号
export const DEVICE_KEY = "suipian.device";        // 这台设备的随机编号（浏览器数据被清除就会丢，丢了会生成新的）
export const SESSION_KEY = "suipian.session";      // 当前登录的账号编号（没有 = 游客）
const ACCT_PREFIX = "suipian.acct.";

const acctKey = (userId) => ACCT_PREFIX + userId;

function safeGet(storage, key) { try { return storage.getItem(key); } catch { return null; } }
function safeSet(storage, key, value) { try { storage.setItem(key, value); return true; } catch { return false; } }
function safeRemove(storage, key) { try { storage.removeItem(key); return true; } catch { return false; } }

function getOrCreateId(storage, key) {
  const old = safeGet(storage, key);
  if (isId(old)) return old;
  const id = newId();
  safeSet(storage, key, id); // 写不进去（无痕模式）也能用，只是下次打开会换一个
  return id;
}
export const getDeviceId = (storage) => getOrCreateId(storage, DEVICE_KEY);
export const getGuestId = (storage) => getOrCreateId(storage, GUEST_ID_KEY);

// 原样读取游客记录的文本（不解析、不修改）
export const readGuestRaw = (storage) => safeGet(storage, GUEST_KEY);

// ---------- 当前账号 ----------
export function getCurrentAccount(storage) {
  const id = safeGet(storage, SESSION_KEY);
  return isId(id) ? id : null;
}
export function setCurrentAccount(storage, userId) {
  if (userId === null) return safeRemove(storage, SESSION_KEY);
  return isId(userId) ? safeSet(storage, SESSION_KEY, userId) : false;
}

// ---------- 账号副本 ----------
// 副本的格式：{ doc, base, dirty }，base 是上次和云端同步时的云端版本号（给同步层用），dirty 记录红心 / 设置是否在上次同步后改过。
export function loadAccount(storage, userId) {
  if (!isId(userId)) return { ok: false, code: "bad-user", message: "账号编号无效" };
  const raw = safeGet(storage, acctKey(userId));
  if (raw === null) return { ok: true, copy: null };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, code: "corrupt", message: "这个账号的本机副本损坏" }; }
  const n = normalizeDoc(parsed?.doc);
  if (!n.ok) return { ok: false, code: n.code, message: n.message };
  return { ok: true, copy: { doc: n.doc, base: parsed.base ?? null, dirty: { hearts: !!parsed.dirty?.hearts, prefs: !!parsed.dirty?.prefs } } };
}
export function saveAccount(storage, userId, copy) {
  if (!isId(userId)) return false;
  const n = normalizeDoc(copy?.doc);
  if (!n.ok) return false;
  const payload = JSON.stringify({ doc: n.doc, base: copy.base ?? null, dirty: { hearts: !!copy.dirty?.hearts, prefs: !!copy.dirty?.prefs } });
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
// 其他任何情况（失败、超时、读回不一致、用户选的是云端进度）都保留游客记录。
export function clearGuestAfterVerified(storage, { userChoseTransfer, uploadOk, uploaded, readBack }) {
  if (userChoseTransfer !== true || uploadOk !== true) return false;
  if (!readBack || !uploaded || !docsEquivalent(uploaded, readBack)) return false;
  return safeRemove(storage, GUEST_KEY);
}
