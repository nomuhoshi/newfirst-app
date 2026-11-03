// 写代码 / 改代码题的草稿：只存在本机，键 = 游客或账号编号 + 题目编号 + 题目版本，独立于学习进度（suipian.progress 完全不碰）。
// 所有读写都包在 try/catch 里：存储被禁用或写满时返回失败，不抛错，当前会话照常可用。
// 游客编号 / 账号编号用的键和 PR #11 的账号层一致（suipian.guestId / suipian.session）；#11 合并后可改成直接引用它。
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const DRAFT_PREFIX = "suipian.draft.";

const rand = () => {
  const a = new Uint8Array(12);
  (globalThis.crypto || { getRandomValues: (x) => x.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(a);
  return "g" + [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export function ownerId(storage = globalThis.localStorage) {
  try {
    const acct = storage.getItem("suipian.session");
    if (ID_RE.test(acct || "")) return acct;
    let g = storage.getItem("suipian.guestId");
    if (!ID_RE.test(g || "")) { g = rand(); try { storage.setItem("suipian.guestId", g); } catch { /* 写不进去也能用 */ } }
    return g;
  } catch { return "guest"; }
}

export const draftKey = (owner, ex) => `${DRAFT_PREFIX}${owner}.${ex.id}.v${ex.version ?? 1}`;

// 返回 { code, viewed } 或 null（没有草稿 / 草稿损坏）
export function loadDraft(storage, owner, ex) {
  try {
    const raw = storage.getItem(draftKey(owner, ex));
    if (raw == null) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || typeof d.code !== "string") return null;
    return { code: d.code, viewed: !!d.viewed, phase: d.phase === "variation" ? "variation" : "original" };
  } catch { return null; }
}

export function saveDraft(storage, owner, ex, { code, viewed, phase }) {
  try { storage.setItem(draftKey(owner, ex), JSON.stringify({ v: 1, code, viewed: !!viewed, phase: phase === "variation" ? "variation" : "original", at: Date.now() })); return true; }
  catch { return false; }
}

export function clearDraft(storage, owner, ex) {
  try { storage.removeItem(draftKey(owner, ex)); return true; } catch { return false; }
}

// 防抖保存：输入后 ms 毫秒存一次。getState() 返回 { code, viewed }；onResult(ok) 报告保存成功 / 失败。
export function createDraftSaver(storage, owner, ex, getState, { ms = 500, onResult = () => {} } = {}) {
  let timer = null;
  const doSave = () => { timer = null; onResult(saveDraft(storage, owner, ex, getState())); };
  return {
    schedule() { clearTimeout(timer); timer = setTimeout(doSave, ms); },
    flush() { if (timer !== null) { clearTimeout(timer); doSave(); } },
    cancel() { clearTimeout(timer); timer = null; },
    pending: () => timer !== null,
  };
}
