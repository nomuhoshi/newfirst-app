// 账号登录与云端同步（编排层）：把 account-data（合并规则）、account-store（本机副本）、cloud-api（网络）接起来。
// 不碰界面，所有外部依赖（存储、网络、时间）都能注入，所以可以在 Node 里用假服务器测试。
// 规则要点（docs/15）：
//  - 本机永远先写：学习进度先落到本机账号副本，再在后台同步；断网也能继续学，联网后自动补上。
//  - XP 只记在“这台设备自己的格子”里，合并时按设备取较大值再相加：重复同步、断网重连、两台设备同时学，都不会重复加分、也不会互相覆盖。
//  - 写云端必须带版本号（save_progress 的 expected_rev）；被抢先就重新读取、合并、再写。
//  - 游客记录只有在“用户明确选择转存 + 上传成功 + 读回一致”时才会清掉，其余情况一律保留。
import { dayKey, freshState } from "./storage.js";
import { emptyDoc, mergeDocs, docsEquivalent, replaceWithGuest, docToState, syncStateIntoDoc, guestFingerprint, normalizeDoc, sumXp } from "./account-data.js";
import { projectScope, projectKey, scopedStorage, getDeviceId, getGuestId, readGuest, getCurrentAccount, setCurrentAccount, loadAccount, saveAccount, logoutLocal, clearGuestAfterVerified } from "./account-store.js";

export const STALE_KEY = "suipian.staleAuth"; // 因换了 Supabase 项目而作废的登录：只记账号编号和邮箱（不含令牌），用来让“同邮箱重新登录”接住旧存档
export const AUTH_KEY = "suipian.auth"; // 登录凭证（访问令牌 + 刷新令牌）。退出登录时删除。

export function createSync({ storage: rawStorage, api, projectId = null, legacyProject = null, now = () => Date.now(), today = () => dayKey(), schedule = (fn, ms) => setTimeout(fn, ms), onStatus = () => {}, onState = () => {}, onNotice = () => {} }) {
  const scope = projectScope(projectId, legacyProject);
  const storage = scopedStorage(rawStorage, scope); // 当前账号 / 账号副本按项目分开存（正式项目沿用原来的键）
  const authKey = scope ? projectKey(scope, "auth") : AUTH_KEY; // 登录凭证同理
  // onNotice("replaced")：别的设备选择“覆盖云端”（代数 +1），这台设备上还没上传的学习内容被替换掉了（docs/15 §5，界面要提示用户）
  let session = null, userId = null, email = "";
  let status = null, pending = false, running = null, again = false, timer = null, retryTimer = null, netFails = 0;
  let baseline = null, lastError = "";
  let waiting = null; // 登录中、等待用户选择“游客记录怎么办”

  const setStatus = (s, msg = "") => { status = s; lastError = msg; try { onStatus(s, msg); } catch {} };
  // 登录凭证跟着“Supabase 项目”走：凭证里记着它是从哪个项目拿到的（主机名）。项目换了（比如测试入口从正式库换到独立测试库），
  // 旧凭证在别的库里没有意义，读到时直接作废并要求重新登录；本机学习记录（游客记录、账号本机副本）一概不动。
  // 没记项目的旧凭证只可能来自正式库（项目标记是后加的），所以按 legacyProject（正式库主机名）处理。projectId 没给 = 不检查（旧测试用）。
  const readAuth = () => {
    try {
      // 其他项目的入口（测试库）永远不用旧位置（正式项目位置）的凭证：读到就作废。
      if (scope) {
        const legacy = JSON.parse(rawStorage.getItem(AUTH_KEY) || "null");
        if (legacy && legacy.session) { try { rawStorage.removeItem(AUTH_KEY); } catch {} } // 只删令牌；正式项目的账号副本和“当前账号”记录不动
      }
      const r = JSON.parse(rawStorage.getItem(authKey));
      if (!r || !r.session || !r.session.userId) return null;
      if (projectId && (r.project || legacyProject) !== projectId) {
        try { rawStorage.setItem(STALE_KEY, JSON.stringify({ userId: r.session.userId, email: String(r.session.email || "").trim().toLowerCase(), project: r.project || legacyProject || "" })); rawStorage.removeItem(authKey); } catch {}
        return null;
      }
      return r.session;
    } catch { return null; }
  };
  const writeAuth = () => { try { if (session) rawStorage.setItem(authKey, JSON.stringify(projectId ? { session, project: projectId } : { session })); else rawStorage.removeItem(authKey); } catch {} };
  const readStale = () => { try { const r = JSON.parse(rawStorage.getItem(STALE_KEY)); return r && typeof r.userId === "string" ? r : null; } catch { return null; } };
  const clearStale = () => { try { rawStorage.removeItem(STALE_KEY); } catch {} };
  const statusFromFailure = (r) => (r.kind === "network" ? "offline" : r.kind === "auth" ? "need-login" : r.kind === "rate-limit" ? "error" : "error");

  // 同一浏览器的其他标签页共用这份凭证：别的标签页刷新令牌后会写回存储。
  // 刷新令牌是一次性的，拿内存里的旧令牌再去刷新，Supabase 会当作令牌被盗、把整个会话作废（所有标签页都被退出）。
  // 所以每次用令牌前先看存储里有没有同一账号、更新的凭证，有就换用。
  function adoptStoredSession() {
    const s = readAuth();
    if (!s || s.userId !== userId || !s.refreshToken) return false;
    if (session && (s.refreshToken === session.refreshToken || !(s.expiresAt > session.expiresAt))) return false;
    session = s; email = s.email || email;
    return true;
  }

  async function ensureToken() {
    adoptStoredSession();
    if (!session) return { ok: false, kind: "auth", message: "需要重新登录" };
    if (session.expiresAt - now() > 60000) return { ok: true };
    const r = await api.refresh(session);
    if (r.ok && r.session.userId === userId) { session = r.session; email = session.email || email; writeAuth(); return { ok: true }; }
    // 刷新失败，可能是另一个标签页刚好抢先刷新了：再看一次存储
    if (!r.ok && r.kind === "auth" && adoptStoredSession() && session.expiresAt - now() > 60000) return { ok: true };
    return r.ok ? { ok: false, kind: "auth", message: "登录账号不一致" } : r;
  }

  // ---------- 启动：恢复上次登录的账号（只读本机，不联网）----------
  function restore(baseState = null) {
    const uid = getCurrentAccount(storage);
    if (!uid) { if (scope) readAuth(); return null; } // 其他项目：没有当前账号也要先把旧位置（正式项目）的凭证作废
    const L = loadAccount(storage, uid, { now: now() });
    if (!L.ok || !L.copy) return null;
    const s = readAuth();
    session = s && s.userId === uid ? s : null;
    userId = uid; email = session?.email || "";
    const state = docToState(L.copy.doc, baseState ? { ...baseState, onboarded: true } : { ...freshState(), onboarded: true }, now());
    baseline = { xp: state.xp, lessonsCompleted: state.lessonsCompleted };
    pending = true;
    setStatus(session ? "pending" : "need-login");
    return { userId, email, state };
  }

  // ---------- 学习进度写入本机副本（app.persist 在登录状态下调用这个）----------
  function persistLocal(state) {
    if (!userId) return { ok: false, code: "no-account" };
    const d = getDeviceId(storage);
    if (!d.ok) return { ok: false, code: d.code, message: d.message };
    const L = loadAccount(storage, userId, { now: now() });
    if (!L.ok || !L.copy) return { ok: false, code: L.code || "no-copy", message: L.message };
    const { doc, changed } = syncStateIntoDoc(L.copy.doc, state, { deviceId: d.id, today: today(), now: now(), baseline });
    const ok = saveAccount(storage, userId, { doc, base: L.copy.base, dirty: { hearts: L.copy.dirty.hearts || changed.hearts, prefs: L.copy.dirty.prefs || changed.prefs, content: L.copy.dirty.content || changed.xp || changed.runs || changed.done || changed.days } }, { now: now() });
    if (!ok) return { ok: false, code: "save-failed", message: "无法保存到本机" };
    baseline = { xp: state.xp, lessonsCompleted: state.lessonsCompleted };
    pending = true;
    if (status !== "offline" && status !== "need-login") setStatus("pending");
    scheduleSync(1500);
    return { ok: true };
  }

  function scheduleSync(ms = 1500) {
    if (!userId || !session) return;
    if (timer) return;
    timer = schedule(() => { timer = null; syncNow(); }, ms);
  }

  // ---------- 同步：读云端 → 合并 → 带版本号写回；被抢先就重来 ----------
  function syncNow() {
    if (!userId) return Promise.resolve({ ok: false, kind: "no-account" });
    if (running) { again = true; return running; }
    running = (async () => {
      try {
        let r, joinedRetry = 0, replaced = false;
        for (;;) {
          again = false; r = await syncOnce();
          if (r.replacedLocal) replaced = true;
          if (r.ok) { netFails = 0; if (again) continue; break; }
          if (r.kind === "network") {
            // 联网了但这一轮因为“断网时发出的请求”失败：如果期间有人又要求同步（again），立刻再试一次，不能把旧的失败当成结果还给他
            if (again && joinedRetry++ < 1) continue;
            scheduleRetry(); // 否则退避重试，不要停在“离线”等下一次用户操作
          }
          break;
        }
        return replaced && r.ok ? { ...r, replacedLocal: true } : r;
      } finally { running = null; }
    })();
    return running;
  }
  function scheduleRetry() {
    if (retryTimer || !userId || !session) return;
    const delay = [3000, 10000, 30000, 60000][Math.min(netFails, 3)]; netFails++;
    retryTimer = schedule(() => { retryTimer = null; syncNow(); }, delay);
  }

  async function syncOnce() {
    setStatus("syncing");
    const t = await ensureToken();
    if (!t.ok) { setStatus(statusFromFailure(t), t.message); return t; }
    for (let attempt = 0; attempt < 5; attempt++) {
      const remote = await api.getProgress(session);
      if (!remote.ok) { setStatus(statusFromFailure(remote), remote.message); return remote; }
      const L = loadAccount(storage, userId, { now: now() });
      if (!L.ok || !L.copy) { setStatus("error", "本机账号记录读取失败"); return { ok: false, kind: "local", message: "本机账号记录读取失败" }; }
      const copy = L.copy;
      let finalDoc, rev, replaced = false;
      if (!remote.row) {
        const c = await api.createProgress(session, copy.doc);
        if (!c.ok) { setStatus(statusFromFailure(c), c.message); return c; }
        if (c.rev === null) continue; // 刚好有别的设备抢先创建了：重新读
        finalDoc = copy.doc; rev = c.rev;
      } else {
        const m = mergeDocs(copy.doc, remote.row.doc, { localHeartsDirty: copy.dirty.hearts, localPrefsDirty: copy.dirty.prefs });
        if (m.error) { setStatus("error", m.error.message); return { ok: false, kind: "data", code: m.error.code, message: m.error.message }; }
        if (m.outcome === "conflict") { setStatus("conflict"); return { ok: false, kind: "conflict", message: "这个账号在别处被“覆盖”过，需要选择保留哪一份" }; }
        finalDoc = m.doc; rev = remote.row.rev;
        if (m.outcome === "remote-newer" && copy.dirty.content) replaced = true;
        if (!docsEquivalent(finalDoc, remote.row.doc)) {
          const s = await api.saveProgress(session, remote.row.rev, finalDoc);
          if (!s.ok) { setStatus(statusFromFailure(s), s.message); return s; }
          if (s.rev === null) continue; // 被抢先：重新读、合并、再写
          rev = s.rev;
        }
      }
      // 同步期间用户可能又学了新内容：把云端结果合并进新的本机副本，下一轮再上传
      const cur = loadAccount(storage, userId, { now: now() });
      const curCopy = cur.ok && cur.copy ? cur.copy : copy;
      let saveDoc = finalDoc, dirty = { hearts: false, prefs: false, content: false };
      if (!docsEquivalent(curCopy.doc, copy.doc)) {
        const m2 = mergeDocs(curCopy.doc, finalDoc, { localHeartsDirty: true, localPrefsDirty: true });
        if (m2.doc) {
          const lost = m2.outcome === "remote-newer";
          if (lost && curCopy.dirty.content) replaced = true;
          saveDoc = m2.doc; dirty = { hearts: curCopy.dirty.hearts, prefs: curCopy.dirty.prefs, content: !lost && curCopy.dirty.content }; again = true;
        }
      }
      saveAccount(storage, userId, { doc: saveDoc, base: rev, dirty }, { now: now() });
      if (!docsEquivalent(curCopy.doc, saveDoc)) { // 云端带来了本机没有的内容：用合并后的结果刷新应用状态，并把“新挣的 XP”的基准同步成新的总数
        const ns = docToState(saveDoc, null, now());
        baseline = { xp: ns.xp, lessonsCompleted: ns.lessonsCompleted };
        onState(saveDoc);
      }
      pending = again;
      setStatus(again ? "pending" : "synced");
      if (replaced) { try { onNotice("replaced", {}); } catch {} }
      return replaced ? { ok: true, rev, replacedLocal: true } : { ok: true, rev };
    }
    setStatus("error", "同步冲突太多次，请稍后再试");
    return { ok: false, kind: "server", message: "同步冲突太多次，请稍后再试" };
  }

  // ---------- 登录 ----------
  const sendCode = (addr) => api.sendCode(String(addr).trim());

  // 验证码 → 会话；然后看游客记录需不需要用户选择
  async function verify(addr, code, baseState = null) {
    const r = await api.verifyCode(String(addr).trim(), code);
    if (!r.ok) return r;
    return begin(r.session, baseState);
  }

  async function begin(newSession, baseState) {
    // 换了 Supabase 项目后旧登录作废：用“同一个邮箱”可以在新项目正常登录，但只加载新项目自己的进度。
    // 旧项目的账号副本和游客记录原样留在本机，既不上传到新项目、也不删除（数据隔离规则）。换成别的邮箱仍要先退出。
    let leaveStale = false;
    if (userId && userId !== newSession.userId) {
      const st = readStale(), mail = String(newSession.email || "").trim().toLowerCase();
      if (!session && st && st.userId === userId && st.email && st.email === mail) leaveStale = true;
      else return { ok: false, kind: "other-account", message: "请先退出当前账号" };
    }
    const remote = await api.getProgress(newSession);
    if (!remote.ok) return remote;
    const remoteDoc = remote.row ? normalizeDoc(remote.row.doc) : null;
    if (remoteDoc && !remoteDoc.ok) return { ok: false, kind: "data", code: remoteDoc.code, message: "云端记录：" + remoteDoc.message };
    const L = loadAccount(storage, newSession.userId, { now: now() });
    if (!L.ok) return { ok: false, kind: "local", message: L.message };
    const guest = readGuest(storage);
    const guestHas = guest.status === "ok" && guestFingerprint(guest.state) !== guestFingerprint(freshState());
    const gid = getGuestId(storage);
    const alreadyImported = !!(remoteDoc && gid.ok && remoteDoc.doc.imported[gid.id]);
    const ctx = { session: newSession, remote, remoteDoc: remoteDoc ? remoteDoc.doc : null, copy: L.copy, guest, baseState, leaveStale };
    if (guestHas && !L.copy && !alreadyImported) {
      waiting = ctx;
      return { ok: true, needChoice: true, cloudHasData: !!remoteDoc && sumXp(remoteDoc.doc) + Object.keys(remoteDoc.doc.done).length > 0, guest: { xp: guest.state.xp ?? 0, lessons: Object.keys(guest.state.done ?? {}).filter((k) => guest.state.done[k]).length } };
    }
    return finish(ctx, null);
  }

  // choice：null（不用选）| "transfer"（把游客进度转存到账号；云端已有进度时 = 用游客覆盖云端）| "cloud"（用云端 / 新账号，游客记录原样保留）
  async function finishChoice(choice) {
    const ctx = waiting; waiting = null;
    if (!ctx) return { ok: false, kind: "local", message: "没有等待选择的登录" };
    return finish(ctx, choice);
  }

  async function finish(ctx, choice) {
    const uid = ctx.session.userId;
    const d = getDeviceId(storage), g = getGuestId(storage);
    if (!d.ok) return { ok: false, kind: "local", message: d.message };
    let doc, base = ctx.remote.row ? ctx.remote.row.rev : null, transferred = false;
    if (ctx.copy) { doc = ctx.copy.doc; base = ctx.copy.base ?? base; } // 这台设备以前登录过这个账号：沿用本机副本，随后正常合并
    else if (choice === "transfer") {
      if (!g.ok || ctx.guest.status !== "ok") return { ok: false, kind: "local", message: "游客记录读取失败，没有转存" };
      const r = replaceWithGuest(ctx.guest.state, { deviceId: d.id, guestId: g.id, cloudDoc: ctx.remoteDoc, now: now(), choice: "replace" });
      if (!r.ok) return { ok: false, kind: "data", message: r.message };
      doc = r.doc; transferred = r.outcome === "created" || r.outcome === "replaced";
    } else doc = ctx.remoteDoc ?? emptyDoc();
    const copy = { doc, base, dirty: { hearts: transferred, prefs: transferred, content: transferred } };
    if (!saveAccount(storage, uid, copy, { now: now(), expectEmpty: !ctx.copy })) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
    if (!setCurrentAccount(storage, uid)) return { ok: false, kind: "local", message: "无法记录当前账号" };
    session = ctx.session; userId = uid; email = session.email || ""; writeAuth();
    const state = docToState(doc, ctx.baseState ? { ...ctx.baseState, onboarded: true } : { ...freshState(), onboarded: true }, now());
    baseline = { xp: state.xp, lessonsCompleted: state.lessonsCompleted };
    pending = true;
    const r = await syncNow();
    if (ctx.leaveStale) clearStale(); // 旧项目的账号副本不动、不上传、不删除；只是不再需要“换项目”的过渡标记
    let guestCleared = false;
    if (r.ok && transferred && ctx.guest.status === "ok") {
      const rb = await api.getProgress(session);
      if (rb.ok && rb.row) guestCleared = clearGuestAfterVerified(storage, { userChoseTransfer: true, uploadOk: true, uploaded: doc, readBack: rb.row.doc, guestSnapshotRaw: ctx.guest.raw });
    }
    // 同步之后以本机副本为准重新生成状态（可能合并了云端内容）
    const L2 = loadAccount(storage, uid, { now: now() });
    const finalState = L2.ok && L2.copy ? docToState(L2.copy.doc, ctx.baseState ? { ...ctx.baseState, onboarded: true } : { ...freshState(), onboarded: true }, now()) : state;
    baseline = { xp: finalState.xp, lessonsCompleted: finalState.lessonsCompleted };
    return { ok: true, state: finalState, account: { userId, email }, synced: r.ok, syncError: r.ok ? "" : r.message || "", guestCleared };
  }

  // ---------- 退出 / 删除 ----------
  // 有没同步的内容时先试着同步一次；同步失败就返回 { ok:false, pending:true }，界面让用户确认；force 才会丢弃
  async function logout({ force = false } = {}) {
    if (!userId) return { ok: true };
    if (pending && !force) {
      const r = await syncNow();
      if (!r.ok) return { ok: false, pending: true, kind: r.kind, message: r.message };
    }
    if (session) { try { await api.signOut(session); } catch {} }
    const uid = userId;
    // 强制退出（没上传的内容还在）：本机副本留着，不删。同一个账号再登录时会接着上传；只有已同步的账号才删副本。
    if (force && pending) setCurrentAccount(storage, null); else logoutLocal(storage, uid);
    clearStale();
    session = null; userId = null; email = ""; baseline = null; pending = false; waiting = null;
    writeAuth();
    setStatus(null);
    return { ok: true };
  }

  async function deleteAccount() {
    if (!userId) return { ok: false, kind: "no-account" };
    const t = await ensureToken();
    if (!t.ok) return t;
    const r = await api.deleteAccount(session);
    if (!r.ok) return r;
    const uid = userId;
    logoutLocal(storage, uid);
    session = null; userId = null; email = ""; baseline = null; pending = false;
    writeAuth(); setStatus(null);
    return { ok: true };
  }

  return {
    restore, persistLocal, syncNow, scheduleSync, sendCode, verify, finishChoice, logout, deleteAccount,
    account: () => (userId ? { userId, email } : null),
    status: () => ({ status, pending, message: lastError }),
  };
}
