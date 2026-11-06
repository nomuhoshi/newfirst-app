// 账号登录与云端同步（编排层）：把 account-data（合并规则）、account-store（本机副本）、cloud-api（网络）接起来。
// 不碰界面，所有外部依赖（存储、网络、时间）都能注入，所以可以在 Node 里用假服务器测试。
// 规则要点（docs/15）：
//  - 本机永远先写：学习进度先落到本机账号副本，再在后台同步；断网也能继续学，联网后自动补上。
//  - XP 只记在“这台设备自己的格子”里，合并时按设备取较大值再相加：重复同步、断网重连、两台设备同时学，都不会重复加分、也不会互相覆盖。
//  - 写云端必须带版本号（save_progress 的 expected_rev）；被抢先就重新读取、合并、再写。
//  - 游客记录只有在“用户明确选择转存 + 上传成功 + 读回一致”时才会清掉，其余情况一律保留。
import { dayKey, freshState } from "./storage.js";
import { emptyDoc, mergeDocs, docsEquivalent, docToState, syncStateIntoDoc, guestHasLearning, guestImportStatus, guestFingerprint, markGuestImported, mergeGuestProgress, normalizeDoc, sumXp, isId } from "./account-data.js";
import { SESSION_KEY, PENDING_IMPORT_PREFIX, getDeviceId, getGuestId, readGuest, getCurrentAccount, setCurrentAccount, loadAccount, saveAccount, logoutLocal, clearGuestAfterVerified, loadPendingImport, savePendingImport, clearPendingImport } from "./account-store.js";

export const STALE_KEY = "suipian.staleAuth"; // 因换了 Supabase 项目而作废的登录：只记账号编号和邮箱（不含令牌），用来让“同邮箱重新登录”接住旧存档
export const AUTH_KEY = "suipian.auth"; // 登录凭证（访问令牌 + 刷新令牌）。退出登录时删除。

const clone = (x) => JSON.parse(JSON.stringify(x));

// 账号相关的键（当前账号、账号本机副本、登录凭证、换项目标记）按 Supabase 项目分开存：
//  - 正式项目（和云端关闭时）沿用原来的键，朋友们现有的存档、登录状态一个字不变；
//  - 其他项目（测试库）的这些键都带 “proj:<主机名>:” 前缀，和正式版的互不可见。两个项目即使碰巧有相同的用户编号，也读不到对方的本机副本。
//  - 游客记录、游客编号、设备编号不分项目（它们是这台设备自己的，不属于任何云端项目）。
export function projectNamespace(projectId, legacyProject) { return projectId && projectId !== "cloud-off" && projectId !== legacyProject ? `proj:${projectId}:` : ""; }
export function scopedStorage(raw, ns) {
  if (!ns) return raw;
  const scoped = (k) => (k === SESSION_KEY || k === AUTH_KEY || k === STALE_KEY || k.startsWith("suipian.acct.") ? ns + k : k);
  return { getItem: (k) => raw.getItem(scoped(k)), setItem: (k, v) => raw.setItem(scoped(k), v), removeItem: (k) => raw.removeItem(scoped(k)) };
}

export function createSync({ storage: rawStorage, api, projectId = null, legacyProject = null, now = () => Date.now(), today = () => dayKey(), schedule = (fn, ms) => setTimeout(fn, ms), onStatus = () => {}, onState = () => {}, onNotice = () => {} }) {
  const storage = scopedStorage(rawStorage, projectNamespace(projectId, legacyProject));
  // onNotice("replaced")：别的设备选择“覆盖云端”（代数 +1），这台设备上还没上传的学习内容被替换掉了（docs/15 §5，界面要提示用户）
  let session = null, userId = null, email = "";
  let status = null, pending = false, running = null, again = false, timer = null, retryTimer = null, netFails = 0;
  let cooldownUntil = 0; // 收到 429 之后的本地冷却截止时间（用注入的 now，测试可以拨快，不会真的发验证码）
  const COOLDOWN_MS = 60_000;
  let baseline = null, lastError = "";
  let waiting = null; // 登录中、等待用户选择“游客记录怎么办”

  const setStatus = (s, msg = "") => { status = s; lastError = msg; try { onStatus(s, msg); } catch {} };
  const normalizedEmail = (x) => String(x || "").trim().toLowerCase();
  // 一份能用于联网的凭证必须字段齐全：没有访问令牌 / 刷新令牌 / 过期时间的残缺凭证只当作“需要重新登录”，
  // 绝不把 undefined / 旧项目 / 别的账号的令牌拼进 Authorization 发出去。
  const isSessionShape = (s) => !!s
    && isId(s.userId)
    && typeof s.accessToken === "string" && s.accessToken.trim() !== ""
    && typeof s.refreshToken === "string" && s.refreshToken.trim() !== ""
    && Number.isFinite(s.expiresAt) && s.expiresAt > 0;
  // 登录凭证跟着“Supabase 项目”走：凭证里记着它是从哪个项目拿到的（主机名）。项目换了（比如测试入口从正式库换到独立测试库），
  // 旧凭证在别的库里没有意义，读到时直接作废并要求重新登录；本机学习记录（游客记录、账号本机副本）一概不动。
  // 没记项目的旧凭证只可能来自正式库（项目标记是后加的），所以按 legacyProject（正式库主机名）处理。projectId 没给 = 不检查（旧测试用）。
  const readAuth = () => {
    try {
      const r = JSON.parse(storage.getItem(AUTH_KEY));
      if (!r || !isSessionShape(r.session)) return null;
      if (projectId && (r.project || legacyProject) !== projectId) {
        // 不是这个项目的凭证：只是不用它（返回空）。绝不删除——它可能是另一个入口（正式版）还在用的登录。只留一个不含令牌的提示标记。
        try { storage.setItem(STALE_KEY, JSON.stringify({ userId: r.session.userId, email: normalizedEmail(r.session.email), project: r.project || legacyProject || "" })); } catch {}
        return null;
      }
      return r.session;
    } catch { return null; }
  };
  const writeAuth = () => { try { if (isSessionShape(session)) storage.setItem(AUTH_KEY, JSON.stringify(projectId ? { session, project: projectId } : { session })); else storage.removeItem(AUTH_KEY); } catch {} };
  const isUnsent = (c) => !!c && (c.base == null || !!(c.dirty && (c.dirty.hearts || c.dirty.prefs || c.dirty.content)));
  // 损坏/不可读的游客导入待办是硬锁：任何普通同步都不得绕过它。
  // 保持两种错误独立，且不安排自动重试；恢复交由后续专门流程处理。
  function importGuard(result = null, uid = userId) {
    if (!uid) return null;
    const pi = result ?? loadPendingImport(storage, uid);
    if (pi.ok) return null;
    const corrupt = pi.code === "corrupt";
    const failure = {
      ok: false, kind: corrupt ? "import-corrupt" : "import-read-failed",
      code: pi.code, pending: true, pendingImport: true, retryable: false,
      message: corrupt
        ? "游客导入待办损坏，云端同步已暂停。请保留本机数据，等待恢复处理。"
        : "无法读取游客导入待办，云端同步已暂停。请检查本机存储后重试。",
    };
    pending = true;
    setStatus(corrupt ? "import-recovery-required" : "import-read-failed", failure.message);
    return failure;
  }
  // 专用导入必须绑定开始时的待办原文；其他标签页替换记录后，旧操作无权删游客或新待办。
  function pendingIdentityGuard(uid, record, expectedRaw) {
    const pi = loadPendingImport(storage, uid);
    const invalid = importGuard(pi, uid);
    if (invalid) return invalid;
    let currentRaw;
    try { currentRaw = storage.getItem(PENDING_IMPORT_PREFIX + uid); }
    catch { return importGuard({ ok: false, code: "read-failed" }, uid); }
    // 原文仍须逐字一致；解析记录逐字段比较，避免合法对象仅因字段顺序不同而被误判替换。
    if (!pi.record || currentRaw !== expectedRaw || Object.keys(pi.record).some((key) => JSON.stringify(pi.record[key]) !== JSON.stringify(record[key]))) {
      const message = "游客导入待办已被其他页面替换，当前导入已停止。请保留本机数据。";
      pending = true;
      setStatus("import-recovery-required", message);
      return { ok: false, kind: "import-changed", pending: true, pendingImport: true, retryable: false, message };
    }
    return null;
  }
  const readStale = () => { try { const r = JSON.parse(storage.getItem(STALE_KEY)); return r && typeof r.userId === "string" ? r : null; } catch { return null; } };
  const clearStale = () => { try { storage.removeItem(STALE_KEY); } catch {} };
  const statusFromFailure = (r) => (r.kind === "network" ? "offline" : r.kind === "auth" ? "need-login" : r.kind === "rate-limit" ? "error" : "error");
  const armCooldown = () => { cooldownUntil = now() + COOLDOWN_MS; };
  const inCooldown = () => now() < cooldownUntil;
  const rateLimited = () => ({ ok: false, kind: "rate-limit", retryable: false, retryAt: cooldownUntil, message: "发送太频繁了，请等一分钟再试。" });
  // 任何 429 都进入冷却，并且不允许被当成“网络失败”去短间隔重试。
  const noteRateLimit = (r) => { if (r && r.kind === "rate-limit") armCooldown(); return r; };
  // 已经登录 A 时，不给 B 的邮箱发验证码 / 验证码校验请求：先在本机挡住，避免拿错账号的验证码。
  // 没有有效凭证、但有“换项目后同邮箱接管”的标记时，只放行标记里的同一个邮箱。
  function loginBlocked(addr) {
    const mail = normalizedEmail(addr);
    if (!userId) return null;
    if (isSessionShape(session) && session.userId === userId) {
      const cur = normalizedEmail(session.email || email);
      if (cur && mail && mail !== cur) return { ok: false, kind: "other-account", message: "请先退出当前账号" };
      return null;
    }
    const st = readStale();
    if (st && st.userId === userId && st.email && mail && mail !== normalizedEmail(st.email)) {
      return { ok: false, kind: "other-account", message: "请先退出当前账号" };
    }
    return null;
  }

  // 同一浏览器的其他标签页共用这份凭证：别的标签页刷新令牌后会写回存储。
  // 刷新令牌是一次性的，拿内存里的旧令牌再去刷新，Supabase 会当作令牌被盗、把整个会话作废（所有标签页都被退出）。
  // 所以每次用令牌前先看存储里有没有同一账号、更新的凭证，有就换用。
  function adoptStoredSession() {
    const s = readAuth();
    if (!s || s.userId !== userId) return false;
    if (session && (s.refreshToken === session.refreshToken || !(s.expiresAt > session.expiresAt))) return false;
    session = s; email = s.email || email;
    return true;
  }

  async function ensureToken() {
    adoptStoredSession();
    if (!isSessionShape(session) || session.userId !== userId) return { ok: false, kind: "auth", message: "需要重新登录" };
    if (session.expiresAt - now() > 60000) return { ok: true };
    const r = await api.refresh(session);
    if (r.ok && isSessionShape(r.session) && r.session.userId === userId) { session = r.session; email = session.email || email; writeAuth(); return { ok: true }; }
    // 刷新失败，可能是另一个标签页刚好抢先刷新了：再看一次存储
    if (!r.ok && r.kind === "auth" && adoptStoredSession() && session.expiresAt - now() > 60000) return { ok: true };
    return r.ok ? { ok: false, kind: "auth", message: "登录账号不一致" } : r;
  }

  // ---------- 启动：恢复上次登录的账号（只读本机，不联网）----------
  function restore(baseState = null) {
    const uid = getCurrentAccount(storage);
    if (!uid) return null;
    const L = loadAccount(storage, uid, { now: now() });
    if (!L.ok || !L.copy) return null;
    const s = readAuth();
    session = s && s.userId === uid ? s : null;
    userId = uid; email = session?.email || "";
    const state = docToState(L.copy.doc, baseState ? { ...baseState, onboarded: true } : { ...freshState(), onboarded: true }, now());
    baseline = { xp: state.xp, lessonsCompleted: state.lessonsCompleted };
    // 专用待办也算“还有没上传的东西”：不能因为本机副本看起来干净就当成已完成。
    const pi = loadPendingImport(storage, uid);
    pending = isUnsent(L.copy) || !pi.ok || !!pi.record;
    if (!importGuard(pi)) setStatus(session ? "pending" : "need-login");
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
    const dirty = { hearts: L.copy.dirty.hearts || changed.hearts, prefs: L.copy.dirty.prefs || changed.prefs, content: L.copy.dirty.content || changed.xp || changed.runs || changed.done || changed.days };
    const ok = saveAccount(storage, userId, { doc, base: L.copy.base, dirty }, { now: now() });
    if (!ok) return { ok: false, code: "save-failed", message: "无法保存到本机" };
    baseline = { xp: state.xp, lessonsCompleted: state.lessonsCompleted };
    // 本机学习继续正常保存，但不能因为 dirty 更新把恢复锁改回 pending 或启动定时同步。
    const guard = importGuard();
    if (guard) return { ok: true, syncBlocked: guard.kind };
    if (!isUnsent({ base: L.copy.base, dirty })) return { ok: true }; // 这次保存没有新内容（比如只是打开页面）：不标记“有没上传的进度”，也不触发同步
    pending = true;
    if (status !== "offline" && status !== "need-login") setStatus("pending");
    scheduleSync(1500);
    return { ok: true };
  }

  function scheduleSync(ms = 1500) {
    if (!userId || !session || importGuard()) return;
    if (timer) return;
    timer = schedule(() => { timer = null; syncNow(); }, ms);
  }

  // ---------- 同步：读云端 → 合并 → 带版本号写回；被抢先就重来 ----------
  function syncNow() {
    if (!userId) return Promise.resolve({ ok: false, kind: "no-account" });
    const guard = importGuard();
    if (guard) return Promise.resolve(guard);
    if (running) { again = true; return running; }
    running = (async () => {
      try {
        let r, joinedRetry = 0, replaced = false;
        for (;;) {
          again = false; r = await syncOnce();
          if (r.replacedLocal) replaced = true;
          if (r.ok) { netFails = 0; if (again) continue; break; }
          if (r.kind === "network" || r.retryable) {
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
    if (retryTimer || !userId || !session || importGuard()) return;
    const delay = [3000, 10000, 30000, 60000][Math.min(netFails, 3)]; netFails++;
    retryTimer = schedule(() => { retryTimer = null; syncNow(); }, delay);
  }

  async function syncOnce() {
    // 必须早于 ensureToken()（它可能发出 refresh 请求）及任何云端读写。
    const initialGuard = importGuard();
    if (initialGuard) return initialGuard;
    setStatus("syncing");
    if (inCooldown()) {
      const limited = rateLimited();
      setStatus("error", limited.message);
      return limited;
    }
    if (!isSessionShape(session) || session.userId !== userId) {
      const miss = { ok: false, kind: "auth", message: "需要重新登录" };
      setStatus("need-login", miss.message);
      return miss;
    }
    const t = await ensureToken();
    if (!t.ok) { noteRateLimit(t); setStatus(statusFromFailure(t), t.message); return t.kind === "rate-limit" ? { ...t, retryable: false } : t; }
    // 先重试“游客导入”专用待办，再跑普通同步。否则普通合并可能把云端旧 true 当成最新，
    // 让用户已经做过的选择永远写不上去。
    const pi = loadPendingImport(storage, userId);
    // refresh 是异步的：再次检查，避免刷新期间待办变坏后继续写云端。
    const afterTokenGuard = importGuard(pi);
    if (afterTokenGuard) return afterTokenGuard;
    if (pi.record) {
      const pr = await runPendingImport(pi.record, session, { notify: true });
      if (!pr.ok || pr.pending) {
        if (pr.kind === "import-corrupt" || pr.kind === "import-read-failed" || pr.kind === "import-changed") return { ...pr, retryable: false };
        pending = true;
        setStatus(pr.kind === "auth" ? "need-login" : "pending", pr.error || pr.message || "游客导入还没同步完，联网后会自动重试");
        return { ok: false, kind: pr.kind || "verify", message: pr.error || pr.message || "游客导入还没同步完", pendingImport: true, retryable: pr.kind !== "local" && pr.kind !== "data" && pr.kind !== "conflict" && pr.kind !== "auth" };
      }
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const remote = await api.getProgress(session);
      const midFlightGuard = importGuard();
      if (midFlightGuard) return midFlightGuard;
      if (!remote.ok) { noteRateLimit(remote); setStatus(statusFromFailure(remote), remote.message); return remote.kind === "rate-limit" ? { ...remote, retryable: false } : remote; }
      const L = loadAccount(storage, userId, { now: now() });
      if (!L.ok || !L.copy) { setStatus("error", "本机账号记录读取失败"); return { ok: false, kind: "local", message: "本机账号记录读取失败" }; }
      const copy = L.copy;
      let finalDoc, rev, replaced = false;
      if (!remote.row) {
        const beforeCreateGuard = importGuard();
        if (beforeCreateGuard) return beforeCreateGuard;
        const c = await api.createProgress(session, copy.doc);
        const afterCreateGuard = importGuard();
        if (afterCreateGuard) return afterCreateGuard;
        if (!c.ok) { noteRateLimit(c); setStatus(statusFromFailure(c), c.message); return c.kind === "rate-limit" ? { ...c, retryable: false } : c; }
        if (c.rev === null) continue; // 刚好有别的设备抢先创建了：重新读
        finalDoc = copy.doc; rev = c.rev;
      } else {
        const m = mergeDocs(copy.doc, remote.row.doc, { localHeartsDirty: copy.dirty.hearts, localPrefsDirty: copy.dirty.prefs });
        if (m.error) { setStatus("error", m.error.message); return { ok: false, kind: "data", code: m.error.code, message: m.error.message }; }
        if (m.outcome === "conflict") { setStatus("conflict"); return { ok: false, kind: "conflict", message: "这个账号在别处被“覆盖”过，需要选择保留哪一份" }; }
        finalDoc = m.doc; rev = remote.row.rev;
        if (m.outcome === "remote-newer" && copy.dirty.content) replaced = true;
        if (!docsEquivalent(finalDoc, remote.row.doc)) {
          const beforeSaveGuard = importGuard();
          if (beforeSaveGuard) return beforeSaveGuard;
          const s = await api.saveProgress(session, remote.row.rev, finalDoc);
          const afterSaveGuard = importGuard();
          if (afterSaveGuard) return afterSaveGuard;
          if (!s.ok) { noteRateLimit(s); setStatus(statusFromFailure(s), s.message); return s.kind === "rate-limit" ? { ...s, retryable: false } : s; }
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
    // 五次都被抢先：停在这里，不安排下一轮盲目重试。本机副本保持脏 / 待同步，用户或下次手动同步还能再传。
    pending = true;
    setStatus("error", "同步冲突太多次，请稍后再试");
    return { ok: false, kind: "server", retryable: false, message: "同步冲突太多次，请稍后再试" };
  }

  // ---------- 登录 ----------
  async function sendCode(addr) {
    const blocked = loginBlocked(addr);
    if (blocked) return blocked;
    // 冷却期内不再调用发信接口。测试只用假接口，这里也不会向任何真实邮箱发验证码。
    if (inCooldown()) return rateLimited();
    const r = await api.sendCode(String(addr).trim());
    if (r && r.kind === "rate-limit") armCooldown();
    return r;
  }

  // 验证码 → 会话；然后看游客记录需不需要用户选择
  async function verify(addr, code, baseState = null) {
    const blocked = loginBlocked(addr);
    if (blocked) return blocked;
    const r = await api.verifyCode(String(addr).trim(), code);
    if (!r.ok) return r;
    return begin(r.session, baseState);
  }

  async function begin(newSession, baseState) {
    if (!isSessionShape(newSession)) return { ok: false, kind: "auth", message: "登录返回的凭证无效" };
    // 换了 Supabase 项目后旧登录作废：用“同一个邮箱”可以在新项目正常登录，但只加载新项目自己的进度。
    // 旧项目的账号副本和游客记录原样留在本机，既不上传到新项目、也不删除（数据隔离规则）。换成别的邮箱仍要先退出。
    let leaveStale = false;
    if (userId && userId !== newSession.userId) {
      const st = readStale(), mail = normalizedEmail(newSession.email);
      if (!session && st && st.userId === userId && st.email && normalizedEmail(st.email) === mail) leaveStale = true;
      else return { ok: false, kind: "other-account", message: "请先退出当前账号" };
    }
    const remote = await api.getProgress(newSession);
    if (!remote.ok) return remote;
    const remoteDoc = remote.row ? normalizeDoc(remote.row.doc) : null;
    if (remoteDoc && !remoteDoc.ok) return { ok: false, kind: "data", code: remoteDoc.code, message: "云端记录：" + remoteDoc.message };
    const L = loadAccount(storage, newSession.userId, { now: now() });
    if (!L.ok) return { ok: false, kind: "local", message: L.message };
    const guest = readGuest(storage);
    const guestHas = guest.status === "ok" && guestHasLearning(guest.state);
    const gid = getGuestId(storage);
    // guestImportStatus 是唯一的状态来源（replaceWithGuest / 安全合并 / 这里共用）：
    //  - 新指纹格式：指纹相同 same，不同 changed；
    //  - 旧 true 没有指纹：游客有学习记录 → unknown，必须提示；游客完全为空 → same 才允许跳过。
    const importStatus = remoteDoc && gid.ok ? guestImportStatus(remoteDoc.doc, gid.id, guest.state) : "new";
    const alreadyImported = importStatus === "same";
    // ctx 里的 remote 只用于“云端有没有数据”的展示；真正写云端前必须重新读最新（弹窗期间别的设备会新增进度）。
    const ctx = { session: newSession, remote, remoteDoc: remoteDoc ? remoteDoc.doc : null, copy: L.copy, guest, guestHas, baseState, leaveStale };
    if (guestHas && !L.copy && !alreadyImported) {
      waiting = ctx;
      return { ok: true, needChoice: true, cloudHasData: !!remoteDoc && sumXp(remoteDoc.doc) + Object.keys(remoteDoc.doc.done).length > 0, guest: { xp: guest.state.xp ?? 0, lessons: Object.keys(guest.state.done ?? {}).filter((k) => guest.state.done[k]).length } };
    }
    return finish(ctx, null);
  }

  // choice：null（不用选）| "transfer" / "merge"（安全合并游客进度）| "cloud"（保留云端，只写游客指纹）
  async function finishChoice(choice) {
    const ctx = waiting;
    if (!ctx) return { ok: false, kind: "local", message: "没有等待选择的登录" };
    const r = await finish(ctx, choice);
    // 网络 / 读云端失败时保留挂起状态，用户可以在同一个弹窗里重试；成功才清掉。
    if (r.ok) waiting = null;
    else {
      // 如果失败发生在“本机副本已经落盘”之后（例如最后一步写入失败），重试时改走本机副本合并，
      // 不再用 expectEmpty 去覆盖已经存在的副本。
      const c = loadAccount(storage, ctx.session.userId, { now: now() });
      if (c.ok && c.copy) ctx.copy = c.copy;
    }
    return r;
  }

  // 登录弹窗挂起期间，别的设备可能已经往云端写了新进度。所有实际写入前都必须重新读最新云端，
  // 不能复用验证码登录时那份旧 remoteDoc。返回规范化文档 + 原始文档（只写指纹时要逐字保留其他字段）。
  async function readLatestCloud(sess = session) {
    if (!sess) return { ok: false, kind: "auth", message: "需要重新登录" };
    // 登录流程里还没把全局 session 设上，直接使用刚验证得到的 ctx.session。
    if (sess === session) {
      const t = await ensureToken();
      if (!t.ok) return t;
    }
    const r = await api.getProgress(sess);
    if (!r.ok) return r;
    if (!r.row) return { ok: true, row: null };
    const n = normalizeDoc(r.row.doc);
    if (!n.ok) return { ok: false, kind: "data", code: n.code, message: "云端记录：" + n.message };
    return { ok: true, row: { doc: n.doc, rev: r.row.rev }, rawDoc: r.row.doc };
  }

  const cleanDirty = { hearts: false, prefs: false, content: false };
  function saveLoginCopy(uid, doc, base, dirty, expectEmpty) {
    return saveAccount(storage, uid, { doc, base, dirty }, { now: now(), expectEmpty });
  }

  // 把本机副本里尚未上传的改动并进“基于最新云端算出的文档”，避免重试待办时把用户期间新学的进度覆盖掉。
  // 只合并同一代 / 同一 lineage；账号在别处被替换时返回 conflict，让用户重新选择，绝不静默覆盖。
  function preserveLocalChanges(uid, doc, baseDoc) {
    const L = loadAccount(storage, uid, { now: now() });
    if (!L.ok) return { ok: false, kind: "local", message: L.message || "本机账号记录读取失败" };
    if (!L.copy) return { ok: true, doc };
    if (baseDoc && docsEquivalent(L.copy.doc, baseDoc)) return { ok: true, doc };
    if (L.copy.doc.gen !== doc.gen || L.copy.doc.lineage !== doc.lineage) {
      return { ok: false, kind: "conflict", message: "这个账号在别处被替换过，游客导入需要重新选择" };
    }
    const m = mergeDocs(L.copy.doc, doc, { localHeartsDirty: L.copy.dirty.hearts, localPrefsDirty: L.copy.dirty.prefs });
    if (!m.doc || m.outcome === "conflict") return { ok: false, kind: "conflict", message: "这个账号在别处被替换过，游客导入需要重新选择" };
    return { ok: true, doc: m.doc };
  }
  // 失败时本机副本不能带上“还没确认写进云端”的新指纹；把这一项还原成云端原来的值（旧 true / 旧指纹 / 没有）。
  function withoutGuestImport(doc, guestId, baseDoc) {
    const out = clone(doc);
    const prev = baseDoc?.imported?.[guestId];
    if (prev) out.imported[guestId] = prev;
    else delete out.imported[guestId];
    return out;
  }

  // 选“保留云端”：重读最新云端 → 只写 imported[游客编号] = 当前指纹 → CAS 保存 → 读回一致。
  // 关键：在“写入成功 + 读回确认”之前，本机副本绝不保存新指纹，也不标成干净；失败时专用待办留在本机。
  async function writeKeepCloud(uid, guestId, guestState, fingerprint, sess) {
    const first = loadAccount(storage, uid, { now: now() });
    if (!first.ok) return { ok: false, kind: "local", message: first.message || "本机账号记录读取失败" };
    let latest = await readLatestCloud(sess);
    if (!latest.ok) return { ...latest, pending: true };
    let doc = null, rev = null, uploaded = false, error = "", kind = null, lastBase = null, lastCloud = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      // 云端还没有记录时，用本机已有副本（如果有）当底，保证重试时代数 / lineage 不变。
      lastCloud = latest.row ? latest.row.doc : (first.copy?.doc ?? null);
      lastBase = latest.row ? latest.row.rev : null;
      const raw = latest.row ? (latest.rawDoc ?? latest.row.doc) : (first.copy?.doc ?? emptyDoc());
      const m = markGuestImported(raw, guestId, guestState);
      if (!m.ok) return { ok: false, kind: "data", code: m.code, message: m.message };
      const p = preserveLocalChanges(uid, m.doc, lastCloud);
      if (!p.ok) return { ...p, pending: true };
      doc = p.doc;
      if (!latest.row) {
        const c = await api.createProgress(sess, doc);
        if (!c.ok) { error = c.message || "保存失败"; kind = c.kind; break; }
        if (c.rev === null) { latest = await readLatestCloud(sess); if (!latest.ok) return { ...latest, pending: true }; continue; } // 被抢先创建：重读
        rev = c.rev; uploaded = true; break;
      }
      const s = await api.saveProgress(sess, latest.row.rev, doc);
      if (!s.ok) { error = s.message || "保存失败"; kind = s.kind; break; }
      if (s.rev === null) { latest = await readLatestCloud(sess); if (!latest.ok) return { ...latest, pending: true }; continue; } // CAS 冲突：重读再写
      rev = s.rev; uploaded = true; break;
    }
    if (!uploaded) {
      // 五次都是被抢先（没有别的错误种类）：停止盲目重试。网络错误仍保留原来的 kind，允许稍后重试。
      if (!kind) kind = "conflict";
      // 写指纹失败：云端原样、游客原样；本机副本只保存“最新云端 + 本机新学的”，不带新指纹。
      const base = lastCloud ?? (first.copy?.doc ?? emptyDoc());
      const p = preserveLocalChanges(uid, base, lastCloud);
      const localDoc = p.ok ? p.doc : base;
      const dirty = first.copy ? first.copy.dirty : cleanDirty;
      if (!saveLoginCopy(uid, localDoc, lastBase, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ok: true, doc: localDoc, rev: lastBase, synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind, error: error || "保存游客指纹失败" };
    }
    // 上传成功不等于完成：必须重新读回，确认文档一致且新指纹确实在云端。
    let verified = false, readBack = null, rbKind = null, rbError = "";
    const rb = await api.getProgress(sess);
    if (!rb.ok) { rbKind = rb.kind; rbError = rb.message || "读回失败"; }
    else if (!rb.row) { rbKind = "data"; rbError = "读回时云端记录不见了"; }
    else {
      const n = normalizeDoc(rb.row.doc);
      if (!n.ok) { rbKind = "data"; rbError = "云端记录：" + n.message; }
      else { readBack = n.doc; verified = docsEquivalent(doc, n.doc) && n.doc.imported[guestId] === fingerprint; }
    }
    if (!verified) {
      const p = preserveLocalChanges(uid, doc, lastCloud);
      const localDoc = withoutGuestImport(p.ok ? p.doc : doc, guestId, lastCloud);
      const dirty = first.copy ? first.copy.dirty : cleanDirty;
      if (!saveLoginCopy(uid, localDoc, rev, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ok: true, doc: localDoc, rev, synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind: rbKind || "verify", error: rbError || "上传成功，但读回校验失败，游客记录已保留" };
    }
    if (!saveLoginCopy(uid, readBack, rev, cleanDirty, false)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
    return { ok: true, doc: readBack, rev, synced: true, verified: true, guestCleared: false, saved: true, pending: false, error: "" };
  }

  // 选“安全合并”：重读最新云端 → 以云端为底合并游客 XP/次数（按设备取较大值）、关卡/日期并集 →
  // CAS 写入 → 读回与上传文档一致才允许删游客。冲突重读再合并再写，绝不 gen + 1 整份覆盖。
  async function writeMergeGuest(uid, deviceId, record, sess, expectedRaw) {
    const guestId = record.guestId, guestState = record.guestState;
    const first = loadAccount(storage, uid, { now: now() });
    if (!first.ok) return { ok: false, kind: "local", message: first.message || "本机账号记录读取失败" };
    let current = await readLatestCloud(sess);
    if (!current.ok) return { ...current, pending: true };
    let doc = null, rev = null, uploaded = false, error = "", kind = null, lastBase = null, lastCloud = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      // 云端没有记录时用本机副本当底（重试保持 lineage）；mergeGuestProgress 对同一份游客快照是幂等的。
      lastCloud = current.row ? current.row.doc : (first.copy?.doc ?? null);
      lastBase = current.row ? current.row.rev : null;
      const m = mergeGuestProgress(guestState, { deviceId, guestId, cloudDoc: lastCloud, now: now() });
      if (!m.ok) return { ok: false, kind: "data", code: m.code, message: m.message };
      const p = preserveLocalChanges(uid, m.doc, lastCloud);
      if (!p.ok) return { ...p, pending: true };
      doc = p.doc;
      if (!current.row) {
        const c = await api.createProgress(sess, doc);
        if (!c.ok) { error = c.message || "上传失败"; kind = c.kind; break; }
        if (c.rev === null) { current = await readLatestCloud(sess); if (!current.ok) return { ...current, pending: true }; continue; } // 被抢先创建：重读、重新合并
        rev = c.rev; uploaded = true; break;
      }
      const s = await api.saveProgress(sess, current.row.rev, doc);
      if (!s.ok) { error = s.message || "上传失败"; kind = s.kind; break; }
      if (s.rev === null) { current = await readLatestCloud(sess); if (!current.ok) return { ...current, pending: true }; continue; } // CAS 冲突：重读、重新合并
      rev = s.rev; uploaded = true; break;
    }
    if (!uploaded) {
      // 五次都是被抢先：kind 标成 conflict，同步层不会把它当成可盲目重试的网络错误。
      if (!kind) kind = "conflict";
      // 上传失败 / 冲突太多次：游客原文保留；本机副本保留合并结果（不带未确认的新指纹）并标记待上传。
      const localDoc = withoutGuestImport(doc, guestId, lastCloud);
      const dirty = { hearts: !!first.copy?.dirty.hearts, prefs: !!first.copy?.dirty.prefs, content: true };
      if (!saveLoginCopy(uid, localDoc, lastBase, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ok: true, doc: localDoc, rev: lastBase, synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind, error: error || "合并冲突太多次，请稍后再试" };
    }
    // 上传成功不等于读回一致：必须重新读云端，文档与刚上传的完全一致才删游客。
    let verified = false, readBack = null, rbKind = null, rbError = "";
    const rb = await api.getProgress(sess);
    if (!rb.ok) { rbKind = rb.kind; rbError = rb.message || "读回失败"; }
    else if (!rb.row) { rbKind = "data"; rbError = "读回时云端记录不见了"; }
    else {
      const n = normalizeDoc(rb.row.doc);
      if (!n.ok) { rbKind = "data"; rbError = "云端记录：" + n.message; }
      else { readBack = n.doc; verified = docsEquivalent(doc, n.doc); }
    }
    if (!verified) {
      const localDoc = withoutGuestImport(doc, guestId, lastCloud);
      const dirty = { hearts: !!first.copy?.dirty.hearts, prefs: !!first.copy?.dirty.prefs, content: true };
      if (!saveLoginCopy(uid, localDoc, rev, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ok: true, doc: localDoc, rev, synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind: rbKind || "verify", error: rbError || "上传成功，但读回校验失败，游客记录已保留" };
    }
    // readback 是异步的；清 dirty 和删游客之前，必须确认待办原文仍与开始时一致。
    const beforeGuestClear = pendingIdentityGuard(uid, record, expectedRaw);
    if (beforeGuestClear) {
      const localDoc = withoutGuestImport(doc, guestId, lastCloud);
      const dirty = { hearts: !!first.copy?.dirty.hearts, prefs: !!first.copy?.dirty.prefs, content: true };
      if (!saveLoginCopy(uid, localDoc, rev, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ...beforeGuestClear, doc: localDoc, rev, synced: false, verified: true, guestCleared: false, saved: true };
    }
    // 先确保本机副本落盘，再删游客；两步都成功才清游客原文。
    if (!saveLoginCopy(uid, readBack, rev, cleanDirty, false)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
    let guestCleared = false, pending = false, clearError = "";
    const gnow = readGuest(storage);
    if (gnow.status === "ok" && gnow.raw === record.guestRaw) {
      guestCleared = clearGuestAfterVerified(storage, { userChoseTransfer: true, uploadOk: true, uploaded: doc, readBack, guestSnapshotRaw: record.guestRaw });
      if (!guestCleared) { pending = true; clearError = "云端已写入并读回一致，但游客记录删除失败，将重试"; }
    } else if (gnow.status === "read-failed") {
      pending = true; clearError = "云端已写入，但游客记录读取失败，暂不删除，将重试";
    }
    // 游客记录已变化：这份旧快照的导入已完成，但绝不能删掉游客新学的内容；下次登录会按新指纹提示。
    return { ok: true, doc: readBack, rev, synced: true, verified: true, guestCleared, saved: true, pending, error: clearError };
  }

  // 执行一条专用待办：选中“保留云端”或“安全合并”，写云 + 读回确认。成功才清待办。
  async function runPendingImport(record, sess, { notify = false } = {}) {
    const uid = record.userId;
    let expectedRaw;
    try { expectedRaw = storage.getItem(PENDING_IMPORT_PREFIX + uid); }
    catch { return importGuard({ ok: false, code: "read-failed" }, uid); }
    const startGuard = pendingIdentityGuard(uid, record, expectedRaw);
    if (startGuard) return startGuard;
    let r;
    if (record.choice === "cloud") {
      r = await writeKeepCloud(uid, record.guestId, record.guestState, record.fingerprint, sess);
    } else {
      const d = getDeviceId(storage);
      if (!d.ok) return { ok: false, kind: "local", message: d.message };
      r = await writeMergeGuest(uid, d.id, record, sess, expectedRaw);
    }
    if (!r.ok) return r;
    if (r.pending) { pending = true; return r; }
    const finalGuard = pendingIdentityGuard(uid, record, expectedRaw);
    if (finalGuard) return finalGuard;
    if (!clearPendingImport(storage, uid)) {
      pending = true;
      return { ...r, pending: true, synced: false, error: "游客导入已完成，但待办清除失败，将重试" };
    }
    if (notify && r.doc) {
      const ns = docToState(r.doc, null, now());
      baseline = { xp: ns.xp, lessonsCompleted: ns.lessonsCompleted };
      try { onState(r.doc); } catch {}
    }
    return r;
  }

  async function finish(ctx, choice) {
    const uid = ctx.session.userId;
    const d = getDeviceId(storage), g = getGuestId(storage);
    if (!d.ok) return { ok: false, kind: "local", message: d.message };
    const mergeChoice = choice === "transfer" || choice === "merge";
    const wantedImport = choice === "cloud" ? "cloud" : mergeChoice ? "merge" : null;
    let doc, base = ctx.remote.row ? ctx.remote.row.rev : null, result = null, transferred = false;
    if (ctx.guestHas && wantedImport) {
      // 先落一条专用待办：即使写云失败 / 页面被关掉，重开或联网后也知道用户选过什么、该用哪份游客快照。
      if (!g.ok || ctx.guest.status !== "ok") return { ok: false, kind: "local", message: wantedImport === "cloud" ? "游客记录读取失败，没有保存游客指纹" : "游客记录读取失败，没有合并" };
      const existing = loadPendingImport(storage, uid);
      if (!existing.ok) return { ok: false, kind: "local", message: existing.message || "无法读取游客导入待办" };
      let record = existing.record;
      if (!record || record.userId !== uid || record.guestId !== g.id || record.choice !== wantedImport) {
        const fp = guestFingerprint(ctx.guest.state);
        if (!fp) return { ok: false, kind: "data", message: "游客记录无法生成指纹" };
        record = { version: 1, userId: uid, guestId: g.id, choice: wantedImport, fingerprint: fp, guestState: clone(ctx.guest.state), guestRaw: ctx.guest.raw, createdAt: now() };
        if (!savePendingImport(storage, uid, record)) return { ok: false, kind: "local", message: "无法保存游客导入待办，登录没有完成" };
      }
      result = await runPendingImport(record, ctx.session);
      if (!result.ok) return result;
      doc = result.doc; base = result.rev; transferred = wantedImport === "merge";
    } else if (ctx.copy) {
      // 这台设备以前登录过这个账号：沿用本机副本，随后正常合并。
      doc = ctx.copy.doc; base = ctx.copy.base ?? base;
    } else {
      doc = ctx.remoteDoc ?? emptyDoc();
    }
    if (!result || !result.saved) {
      const dirty = ctx.copy ? ctx.copy.dirty : cleanDirty;
      if (!saveAccount(storage, uid, { doc, base, dirty }, { now: now(), expectEmpty: !ctx.copy })) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
    }
    if (!setCurrentAccount(storage, uid)) return { ok: false, kind: "local", message: "无法记录当前账号" };
    session = ctx.session; userId = uid; email = session.email || ""; writeAuth();
    const state = docToState(doc, ctx.baseState ? { ...ctx.baseState, onboarded: true } : { ...freshState(), onboarded: true }, now());
    baseline = { xp: state.xp, lessonsCompleted: state.lessonsCompleted };
    let synced = false, guestCleared = false, syncError = "";
    if (result) {
      synced = result.synced; guestCleared = !!result.guestCleared; syncError = result.error || "";
      pending = !synced || !!result.pending;
      // 云端已写入并读回一致，但还有收尾没完成（例如游客记录删除失败、待办清除失败）：仍是“待同步”，不得显示已同步。
      if (synced && result.verified !== false && !result.pending) setStatus("synced");
      else if (synced && result.verified !== false) setStatus("pending", syncError || "游客导入还有收尾没完成，联网后会自动重试");
      else if (synced) setStatus("error", syncError);
      else setStatus("pending", syncError || result.message || "游客导入还没同步完，联网后会自动重试");
    } else {
      pending = true;
      const r = await syncNow();
      synced = r.ok; syncError = r.ok ? "" : r.message || "";
    }
    if (ctx.leaveStale) clearStale(); // 旧项目的账号副本不动、不上传、不删除；只是不再需要“换项目”的过渡标记
    // 以本机副本为准重新生成状态（可能合并了云端内容，或保留了刚上传的合并结果）
    const L2 = loadAccount(storage, uid, { now: now() });
    const finalState = L2.ok && L2.copy ? docToState(L2.copy.doc, ctx.baseState ? { ...ctx.baseState, onboarded: true } : { ...freshState(), onboarded: true }, now()) : state;
    baseline = { xp: finalState.xp, lessonsCompleted: finalState.lessonsCompleted };
    return { ok: true, state: finalState, account: { userId, email }, synced, syncError, guestCleared, transferred, pending: !synced };
  }

  // ---------- 退出 / 删除 ----------
  function copyStillUnsent(uid) {
    const L = loadAccount(storage, uid, { now: now() });
    return !!(L.ok && L.copy && isUnsent(L.copy));
  }
  // 有没同步的内容时先试着同步一次；同步失败就返回 { ok:false, pending:true }，界面让用户确认；force 才会继续退出。
  // 普通退出：云端 signOut 失败，或本机仍有未上传副本时，保持登录，不删副本。
  // 强制退出：即使 signOut 失败也清本机凭证；未上传副本留着。本机清理失败则不宣称已退出。
  async function logout({ force = false, forceLocal = false } = {}) {
    if (!userId) return { ok: true };
    const dropping = force || forceLocal;
    const guard = importGuard();
    if (guard) {
      if (!dropping) return guard; // 普通退出不能把损坏待办当成已完成。
      // 用户明确选择本机强制退出：不调用云端、不删账号副本、游客或损坏待办。
      const uid = userId;
      const sessionRemoved = setCurrentAccount(storage, null);
      let sessionGone = false;
      try { sessionGone = storage.getItem(SESSION_KEY) === null; } catch {}
      if (!sessionRemoved || !sessionGone) {
        const rollback = setCurrentAccount(storage, uid);
        let restored = false;
        try { restored = storage.getItem(SESSION_KEY) === uid; } catch {}
        return { ok: false, kind: "local", pending: true, rollbackFailed: !rollback || !restored,
          message: restored ? "账号指针删除失败，退出未完成；本机数据仍保留" : "账号指针清理与恢复均失败，请保留本机数据并人工恢复" };
      }
      // 凭证删除失败后必须验证账号指针是否成功回滚，避免把半退出当作成功。
      let authCleared = false;
      try { storage.removeItem(AUTH_KEY); authCleared = storage.getItem(AUTH_KEY) === null; } catch {}
      if (!authCleared) {
        const rollback = setCurrentAccount(storage, uid);
        let restored = false;
        try { restored = storage.getItem(SESSION_KEY) === uid; } catch {}
        return { ok: false, kind: "local", pending: true, rollbackFailed: !rollback || !restored,
          message: restored ? "本机凭证清理失败，退出未完成；数据仍保留" : "凭证清理失败且账号指针回滚失败，请保留本机数据并人工恢复" };
      }
      clearStale();
      session = null; userId = null; email = ""; baseline = null; pending = false; waiting = null;
      setStatus(null);
      return { ok: true, cloudSessionMaybeValid: true, warning: "cloud-session-maybe-valid", message: "已在这台设备退出。损坏的游客导入记录和本机进度已保留；云端会话可能仍有效。" };
    }
    if (pending && !dropping) {
      const r = await syncNow();
      if (!r.ok) return { ok: false, pending: true, kind: r.kind, message: r.message };
    }
    const uid = userId;
    if (!dropping && copyStillUnsent(uid)) {
      pending = true;
      setStatus("pending", "还有进度没上传，没有退出");
      return { ok: false, pending: true, kind: "pending", message: "还有进度没上传，没有退出" };
    }
    let signOutFailed = false, signOutKind = "server", signOutMessage = "退出云端失败";
    if (session && isSessionShape(session)) {
      try {
        const so = await api.signOut(session);
        if (so && so.ok === false) { signOutFailed = true; signOutKind = so.kind || "server"; signOutMessage = so.message || signOutMessage; }
      } catch {
        signOutFailed = true;
      }
    }
    // 普通退出：云端没退出成功就保持登录，未上传副本一个字不动。
    if (signOutFailed && !force && !forceLocal) {
      return { ok: false, stayed: true, kind: signOutKind, pending: copyStillUnsent(uid), message: signOutMessage };
    }
    // 强制退出（没上传的内容还在）：本机副本留着，不删。同一个账号再登录时会接着上传；只有已同步的账号才删副本。
    const localOk = (force && pending) ? setCurrentAccount(storage, null) : logoutLocal(storage, uid);
    if (!localOk) return { ok: false, kind: "local", pending: true, message: "无法完成本机退出，登录和未上传的进度都还在" };
    clearStale();
    session = null; userId = null; email = ""; baseline = null; pending = false; waiting = null;
    writeAuth();
    setStatus(null);
    if (signOutFailed) return { ok: true, cloudSessionMaybeValid: true, warning: "cloud-session-maybe-valid", message: "已在这台设备退出。云端会话可能仍有效。" };
    return { ok: true };
  }

  function forceLocalLogout() {
    return logout({ force: true, forceLocal: true });
  }

  function disableStoredToken() {
    session = null;
    try { storage.removeItem(AUTH_KEY); } catch { /* 存储删不掉时改写成无效内容，下次打开也不会拿去联网 */ }
    try {
      if (storage.getItem(AUTH_KEY) !== null) storage.setItem(AUTH_KEY, JSON.stringify({ revoked: true, reason: "account-deleted-cleanup-failed" }));
    } catch { /* 连改写都不行：内存里的令牌已经丢掉，不再发出去 */ }
    // 当前账号键删不掉时写成空：下次打开不会把已删除的账号再恢复成登录态。副本本身留在原来的键里。
    try { if (getCurrentAccount(storage)) storage.setItem(SESSION_KEY, ""); } catch {}
  }

  async function deleteAccount() {
    if (!userId) return { ok: false, kind: "no-account" };
    const guard = importGuard();
    if (guard) return guard;
    const t = await ensureToken();
    if (!t.ok) return t;
    const afterTokenGuard = importGuard();
    if (afterTokenGuard) return afterTokenGuard;
    const r = await api.deleteAccount(session);
    if (!r.ok) return r;
    const uid = userId;
    let cleaned = false;
    try { cleaned = logoutLocal(storage, uid) && clearPendingImport(storage, uid); } catch { cleaned = false; }
    if (!cleaned) {
      // 云端已经删掉。本机清不干净时：停用旧令牌、留下副本、不宣称完全成功。
      disableStoredToken();
      userId = null; email = ""; baseline = null; pending = false; waiting = null;
      setStatus("pending-local-cleanup", "账号已在云端删除，但这台设备还没清理完。请不要继续用这个登录。");
      return {
        ok: false,
        kind: "local-cleanup",
        pendingLocalCleanup: true,
        tokenRevokedLocally: true,
        copyIsolated: true,
        message: "账号已在云端删除，但这台设备还没清理完。旧登录已停用，请不要继续用。",
      };
    }
    session = null; userId = null; email = ""; baseline = null; pending = false; waiting = null;
    writeAuth(); setStatus(null);
    return { ok: true };
  }

  return {
    restore, persistLocal, syncNow, scheduleSync, sendCode, verify, finishChoice, logout, forceLocalLogout, deleteAccount,
    account: () => (userId ? { userId, email } : null),
    status: () => ({ status, pending, message: lastError }),
  };
}
