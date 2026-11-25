// 账号登录与云端同步（编排层）：把 account-data（合并规则）、account-store（本机副本）、cloud-api（网络）接起来。
// 不碰界面，所有外部依赖（存储、网络、时间）都能注入，所以可以在 Node 里用假服务器测试。
// 规则要点（docs/15）：
//  - 本机永远先写：学习进度先落到本机账号副本，再在后台同步；断网也能继续学，联网后自动补上。
//  - XP 只记在“这台设备自己的格子”里，合并时按设备取较大值再相加：重复同步、断网重连、两台设备同时学，都不会重复加分、也不会互相覆盖。
//  - 写云端必须带版本号（save_progress 的 expected_rev）；被抢先就重新读取、合并、再写。
//  - 游客记录只有在“用户明确选择转存 + 上传成功 + 读回一致”时才会清掉，其余情况一律保留。
import { dayKey, freshState } from "./storage.js";
import { emptyDoc, mergeDocs, docsEquivalent, docToState, syncStateIntoDoc, guestHasLearning, guestImportStatus, guestFingerprint, markGuestImported, mergeGuestProgress, normalizeDoc, sumXp, isId } from "./account-data.js";
import { SESSION_KEY, PENDING_IMPORT_PREFIX, getDeviceId, getGuestId, readGuest, getCurrentAccount, readCurrentAccount, setCurrentAccount, loadAccount, saveAccount, logoutLocal, clearGuestAfterVerified, loadPendingImport, savePendingImport, clearPendingImport, parsePendingImport, readPendingImportRaw, rawDigest, backupCorruptPending } from "./account-store.js";

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

export function createSync({ storage: rawStorage, api, projectId = null, legacyProject = null, now = () => Date.now(), today = () => dayKey(), schedule = (fn, ms) => setTimeout(fn, ms), onStatus = () => {}, onState = () => {}, onNotice = () => {}, onSessionLost = () => {}, retryLocks = null }) {
  const storage = scopedStorage(rawStorage, projectNamespace(projectId, legacyProject));
  // onNotice("replaced")：别的设备选择“覆盖云端”（代数 +1），这台设备上还没上传的学习内容被替换掉了（docs/15 §5，界面要提示用户）
  let session = null, userId = null, email = "", loginInstanceId = null;
  const newLoginInstanceId = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${now()}-${Math.random().toString(36).slice(2)}`);
  let status = null, pending = false, running = null, again = false, timer = null, retryTimer = null, netFails = 0;
  let restoreIssue = null, restoreOwner = null, restoreSeq = 0;
  // 失败详情只放内存；账号代次前进后自动作废，不改变既有 status() 返回契约。
  const restoreError = () => (!userId && restoreOwner?.gen === acctGen && restoreIssue ? { ...restoreIssue } : null);
  const clearRestoreIssue = () => { restoreIssue = null; restoreOwner = null; };
  // 账号会话代次：登录完成 / 恢复 / 退出 / 删除账号时前进。每一轮同步在开始时记下代次，之后每个 await 回来先核对：
  // 代次变了（中间退出过、或又登录了同一账号 / 别的账号），这一轮就是“旧任务”——结果整体丢弃，不写状态、凭证、进度、待同步标记、时间戳，
  // 也不安排重试；它的收尾也只能清理自己的 running。前进代次时同时放掉旧任务占着的 running / again / 定时器，新会话能独立同步。
  let acctGen = 0;
  const staleResult = () => ({ ok: false, kind: "stale", stale: true, retryable: false, message: "账号已退出或切换，这次同步的结果已丢弃" });
  const abandonWaiters = new Set(); // 正占着本机写回锁的同步任务：代次前进时立刻让它们放掉锁（任务本身还在等网络，之后的结果会被丢弃）
  function bumpAcct() { acctGen++; loggingOut = false; selfLogoutCleaning = false; syncCooldownUntil = 0; wakeToken = null; for (const f of [...abandonWaiters]) f(); abandonWaiters.clear(); running = null; again = false; timer = null; retryTimer = null; netFails = 0; localRetryEpoch++; localRetryTimer = null; }
  // 本机写回失败与网络退避完全分开；按账号共享最佳努力计数，刷新页面也不能重新开始无限轮询。
  const LOCAL_RETRY_LIMIT = 3;
  let localWritebackFails = 0, localRetryUser = null, localRetryTimer = null, localRetryEpoch = 0, localRetryUnknown = false;
  let retryLockHeld = false;
  let loggingOut = false; // 普通退出：本机已清理、正在等云端撤销。期间新触发的同步直接作废（否则会把刚清掉的本机副本写回）
  let selfLogoutCleaning = false; // 本操作自身的退出清理 / 回滚阶段：此期间存储里的会话指针与凭证由自己清理，不算跨标签页失权
  const retryLockProvider = retryLocks || (typeof navigator !== "undefined" ? navigator.locks : null);
  const retryLockName = () => `suipian:writeback:${projectNamespace(projectId, legacyProject)}:${userId}`;
  // 锁的等待、占用和释放都绑定“这一轮同步任务”的生命周期：任务一旦成为旧任务（退出 / 换账号，代次前进），立刻放掉锁，
  // 不等它那个迟到的网络响应；否则同一账号重新登录后，新会话的同步要一直排在旧任务后面（真实 Web Locks 下）。
  async function withLocalRetryLock(fn, manual, gen = acctGen) {
    if (retryLockProvider && typeof retryLockProvider.request === "function") {
      let entered = false;
      try {
        return await retryLockProvider.request(retryLockName(), { mode: "exclusive" }, async () => {
          entered = true;
          if (gen !== acctGen) return staleResult(); // 排队等锁期间已经成了旧任务：拿到锁立刻还
          retryLockHeld = true;
          let abandon;
          const abandoned = new Promise((res) => { abandon = () => res(staleResult()); });
          abandonWaiters.add(abandon);
          try { return await Promise.race([fn(), abandoned]); } finally { abandonWaiters.delete(abandon); retryLockHeld = false; }
        });
      } catch (err) {
        if (entered) throw err;
        if (gen !== acctGen) return staleResult(); // 锁请求迟到拒绝时任务已是旧任务（退出 / 换账号）：不改 localRetryUnknown，不改状态
        localRetryUnknown = true; return localRetryBlocked();
      }
    }
    // Node 单进程测试可直接执行；浏览器没有 Web Locks 时普通自动同步安全停机。
    return fn();
  }
  // 收到 429 之后的本地冷却截止时间（用注入的 now，测试可以拨快，不会真的发验证码）。两份，各管各的生命周期：
  //   cooldownUntil     发验证码 / 登录阶段的 429（还没有账号会话）
  //   syncCooldownUntil 已登录会话的同步 429（含令牌刷新）——绑定账号会话代次：退出 / 换账号 / 登录完成时（bumpAcct）立刻作废，
  //                     旧会话的等待不拖住新会话；旧任务回来时已经被代次拦下，不会再改写它。
  // 等待多久：服务器给了合法的 Retry-After（秒数或 HTTP 日期）就完整照它等——不封顶（头的意思就是“重试前至少等这么久”，
  // 截短了就是提前打回去），只设最短 5 秒（合法但已过期 / 0 时防止立刻再打）；没给 / 格式不对一律保底 60 秒。
  // 重复 429 只会把截止时间往后推（取较大值），不会缩短尚未结束的等待。
  // 到期唤醒（wake）：同步冷却结束时自动发起一次同步（同一会话只有一个，重复 429 延期，退出 / 换账号作废）；
  // 定时器单次上限约 24.8 天，更长的等待分段重排，每一段到点都先核对截止时间，绝不提前联网。
  let cooldownUntil = 0, syncCooldownUntil = 0, wakeToken = null;
  const COOLDOWN_MS = 60_000, COOLDOWN_MIN_MS = 5_000, MAX_TIMER_MS = 2_147_483_647;
  let baseline = null, lastError = "", lastDetail = null; // lastDetail：失败的 {kind,status,errorCode,code}，只给界面分类用（界面不显示服务器原文）
  let waiting = null; // 登录中、等待用户选择“游客记录怎么办”
  let resumeChoiceOp = null; // 恢复选择只接受最后一次操作；旧操作的收尾只能释放自己的登记
  // 已验证、但读云端记录失败的登录：邮箱验证码是一次性的，验证接口已经把它用掉，不能再拿同一个码验证第二次。
  // 所以把“验证通过拿到的会话”只放内存里短暂留着（不写存储、不当作登录态、不切账号、不清游客进度），用户点「重试读取」时只重读云端，
  // 不再调用验证接口。绑定邮箱 / userId / 本次流程代次；换邮箱、重发验证码、关窗、退出、到期（≤5 分钟且不超过会话有效期）都会作废；
  // 迟到的响应靠代次丢弃，不会串进新的登录流程。
  const VERIFIED_TTL_MS = 5 * 60_000;
  const READ_TRIES_AUTH = 2;   // 401/403 读不出来：原样重读大概率还是被拒，最多总共读 2 次（首读 + 1 次重试）
  const READ_TRIES_OTHER = 5;  // 503 / 超时 / 断网等瞬时故障：最多总共读 5 次（同时受 5 分钟时限约束）
  let verified = null, verifyGen = 0;

  // 最近一次状态变化和最近一次“确认已同步”的时间（只在内存里，不写存储；测试入口的信息面板读它，重开页面后从头算）。
  let lastStatusAt = null, lastSyncedAt = null;
  const setStatus = (s, msg = "", detail = null) => { status = s; lastError = msg; lastDetail = detail; lastStatusAt = now(); if (s === "synced") lastSyncedAt = lastStatusAt; try { onStatus(s, msg); } catch {} };
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
  const writeAuth = () => {
    try {
      if (isSessionShape(session)) {
        const payload = projectId ? { session, project: projectId } : { session };
        if (loginInstanceId) payload.instanceId = loginInstanceId;
        storage.setItem(AUTH_KEY, JSON.stringify(payload));
      } else storage.removeItem(AUTH_KEY);
    } catch {}
  };
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
  const detailOf = (r) => (r ? { kind: r.kind, status: r.status, errorCode: r.errorCode, code: r.code } : null);
  const statusFromFailure = (r) => (r.kind === "network" ? "offline" : r.kind === "auth" ? "need-login" : r.kind === "rate-limit" ? "error" : "error");
  const cooldownMsFrom = (r) => {
    const sec = r && r.retryAfterSec; // cloud-api 已解析好：合法的 Retry-After（秒数 / HTTP 日期）→ 非负整数秒；缺失 / 格式不对 → 没有这个字段
    return Number.isFinite(sec) && sec >= 0 ? Math.max(COOLDOWN_MIN_MS, Math.ceil(sec * 1000)) : COOLDOWN_MS;
  };
  const armCooldown = (r, forSync = false) => {
    const until = now() + cooldownMsFrom(r);
    if (forSync) { syncCooldownUntil = Math.max(syncCooldownUntil, until); armWake(); } else cooldownUntil = Math.max(cooldownUntil, until);
  };
  function armWake() {
    if (!userId || !session) return;
    const g = acctGen, tok = {}; wakeToken = tok; // 新的一次覆盖旧的：旧定时器到点发现令牌不是自己就什么都不做
    const ms = Math.max(1, Math.min(coolUntil() - now(), MAX_TIMER_MS)); // 实际门禁是两份冷却（发码 / 同步）的较大值：按它排期，不然较长的发码冷却会在唤醒到点时把同步拦下、之后再没人唤醒
    schedule(() => {
      if (wakeToken !== tok || g !== acctGen) return;
      wakeToken = null;
      if (inCooldown()) { armWake(); return; } // 门禁还没放开（分段等待 / 时钟稍早 / 发码冷却更长）：重排剩余时间，不联网
      syncNow(); // 自动同步：停机保护（本机写回上限 / 损坏待办）、会话代次、合并重复触发都由 syncNow 照常处理
    }, ms);
  }
  const coolUntil = () => Math.max(cooldownUntil, syncCooldownUntil);
  const inCooldown = () => now() < coolUntil();
  const rateLimited = () => {
    const left = Math.max(0, coolUntil() - now());
    const wait = left <= COOLDOWN_MS ? "" : left < 3_600_000 ? `约 ${Math.ceil(left / 60_000)} 分钟` : left < 172_800_000 ? `约 ${Math.ceil(left / 3_600_000)} 小时` : left < 31_536_000_000 ? `约 ${Math.ceil(left / 86_400_000)} 天` : "很长一段时间";
    return { ok: false, kind: "rate-limit", retryable: false, retryAt: coolUntil(), message: wait ? `请求太频繁了，请${wait}后再试。` : "发送太频繁了，请等一分钟再试。" };
  };
  // 任何 429 都进入冷却，并且不允许被当成“网络失败”去短间隔重试。noteRateLimit 只在同步任务里用（那里每个 await 之后都已经核对过代次）。
  const noteRateLimit = (r) => { if (r && r.kind === "rate-limit") armCooldown(r, true); return r; };
  // 已经登录 A 时，不给 B 的邮箱发验证码 / 验证码校验请求：先在本机挡住，避免拿错账号的验证码。
  // 没有有效凭证、但有“换项目后同邮箱接管”的标记时，只放行标记里的同一个邮箱。
  function loginBlocked(addr) {
    const mail = normalizedEmail(addr);
    if (!userId) {
      const shared = readCurrentAccount(storage);
      if (shared.ok && shared.id) {
        const a = inspectAuth();
        const cur = a.state === "ours" && a.session.userId === shared.id ? normalizedEmail(a.session.email) : "";
        if (!cur || !mail || mail !== cur) return { ok: false, kind: "other-account", message: "请先退出当前账号" };
      }
      return null;
    }
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

  async function ensureToken(gen = acctGen) {
    const preOwn = checkSessionOwnership();
    if (!preOwn.ok) {
      if (preOwn.kind === "lost") { dropLostSession(preOwn.reason); return staleResult(); }
      return { ok: false, kind: "local", message: "无法确认本机登录状态" };
    }
    adoptStoredSession();
    if (!isSessionShape(session) || session.userId !== userId) return { ok: false, kind: "auth", message: "需要重新登录" };
    if (session.expiresAt - now() > 60000) return { ok: true };
    const r = await api.refresh(session);
    if (gen !== acctGen) return staleResult(); // 刷新期间退出 / 换了账号：旧的刷新结果不能写进新会话，也不能写存储里的凭证
    // 刷新返回后、writeAuth() 写回凭证之前，必须复查共享登录实例所有权，绝不覆盖其他标签页新登录的凭证
    const postOwn = checkSessionOwnership();
    if (!postOwn.ok) {
      if (postOwn.kind === "lost") { dropLostSession(postOwn.reason); return staleResult(); }
      return { ok: false, kind: "local", message: "无法确认本机登录状态" };
    }
    if (r.ok && isSessionShape(r.session) && r.session.userId === userId) { session = r.session; email = session.email || email; writeAuth(); return { ok: true }; }
    // 刷新失败，可能是另一个标签页刚好抢先刷新了：再看一次存储
    if (!r.ok && r.kind === "auth" && adoptStoredSession() && session.expiresAt - now() > 60000) return { ok: true };
    return r.ok ? { ok: false, kind: "auth", message: "登录账号不一致" } : r;
  }

  // ---------- 启动：恢复上次登录的账号（只读本机，不联网）----------
  const restoreIdentity = (a) => a.state === "ours"
    ? { state: a.state, userId: a.session.userId, instanceId: a.instanceId || null }
    : { state: a.state };
  const sameRestoreIdentity = (a, b) => a.state === b.state && a.userId === b.userId && a.instanceId === b.instanceId;
  function restoreAttempt(baseState = null, expected = null) {
    const op = { seq: ++restoreSeq, gen: acctGen, verify: verifyGen, waiting, uid: userId, inst: loginInstanceId };
    const current = () => op.seq === restoreSeq && op.gen === acctGen && op.verify === verifyGen && op.waiting === waiting && op.uid === userId && op.inst === loginInstanceId;
    const stale = () => { if (current()) clearRestoreIssue(); return staleResult(); };
    let uid = expected?.uid || null, identity = expected?.identity || null;
    const fail = (code, target) => {
      if (!current()) return staleResult();
      const retryable = code === "read-failed" || code === "missing";
      const message = code === "schema-newer" ? "账号本机记录来自更新版本的应用，请更新或刷新应用后再试。原记录未改动。"
        : code === "corrupt" ? "账号的本机进度副本已损坏，原记录未改动。请保留本机数据，等待处理。"
        : code === "missing" ? "未找到账号的本机进度副本，请重试恢复，或通过邮箱重新登录读取云端进度。"
        : "暂时无法读取本机账号记录，请重试恢复。";
      restoreIssue = { code, target, userId: uid, retryable, message };
      restoreOwner = { gen: acctGen, uid, identity };
      return { ok: false, kind: retryable ? "local" : "data", error: restoreError(), message };
    };
    const p0 = readCurrentAccount(storage);
    if (!current()) return staleResult();
    if (!p0.ok) return fail("read-failed", "session");
    if (!p0.id || (expected?.uid && p0.id !== expected.uid)) return stale();
    uid = p0.id;
    const a0 = inspectAuth();
    if (!current()) return staleResult();
    if (a0.state === "read-failed") return fail("read-failed", "auth");
    const initialIdentity = restoreIdentity(a0);
    if (expected?.identity && !sameRestoreIdentity(expected.identity, initialIdentity)) return stale();
    identity = initialIdentity;
    // readAuth 的外项目迁移提示仍需保留；不用它折叠读取失败，也不改其返回契约。
    if (a0.state === "other") readAuth();
    const L = loadAccount(storage, uid, { now: now() });
    // 所有副本 / 待办 / state 读取与组装都放在提交前；这些读取也可能触发存储钩子。
    const pi = L.ok && L.copy ? loadPendingImport(storage, uid) : null;
    const state = L.ok && L.copy
      ? docToState(L.copy.doc, baseState ? { ...baseState, onboarded: true } : { ...freshState(), onboarded: true }, now()) : null;
    const a1 = inspectAuth();
    const p1 = readCurrentAccount(storage);
    if (!current()) return staleResult();
    if (!p1.ok) return fail("read-failed", "session");
    if (p1.id !== uid) return stale(); // 已确认退出 / 换号时，旧账号的 AUTH 读失败也不能再挂错误。
    if (a1.state === "read-failed") return fail("read-failed", "auth");
    if (!sameRestoreIdentity(initialIdentity, restoreIdentity(a1))) return stale();
    if (!L.ok) return fail(L.code === "schema-newer" ? "schema-newer" : L.code === "read-failed" ? "read-failed" : "corrupt", "account");
    if (!L.copy) return fail("missing", "account");
    session = a1.state === "ours" && a1.session.userId === uid ? a1.session : null;
    bumpAcct(); userId = uid; email = session?.email || ""; loginInstanceId = session ? (a1.instanceId || null) : null;
    clearRestoreIssue();
    baseline = { xp: state.xp, lessonsCompleted: state.lessonsCompleted };
    pending = isUnsent(L.copy) || !pi.ok || !!pi.record;
    if (!importGuard(pi)) setStatus(session ? "pending" : "need-login");
    return { ok: true, restored: { userId, email, state } };
  }
  function restore(baseState = null) {
    const r = restoreAttempt(baseState);
    return r.ok ? r.restored : null; // 既有调用方以 falsy 判断失败，不能改成 truthy 错误对象。
  }
  function retryRestore(baseState = null) {
    if (userId || !restoreError()) return staleResult();
    return restoreAttempt(baseState, restoreOwner);
  }

  // ---------- 学习进度写入本机副本（app.persist 在登录状态下调用这个）----------
  // 检查当前内存会话是否仍拥有共享存储里的登录实例所有权；读取失败返回 read-failed，确认被其他页面退出/切换/重登返回 lost。
  function checkSessionOwnership() {
    if (!userId) return { ok: true, active: false };
    if (selfLogoutCleaning) return { ok: true, active: true, selfCleaning: true };
    const p = readCurrentAccount(storage);
    if (!p.ok) return { ok: false, kind: "read-failed" };
    if (p.id !== userId) return { ok: false, kind: "lost", reason: p.id ? "switched-account" : "logged-out", currentId: p.id };
    const a = inspectAuth();
    if (a.state === "read-failed") return { ok: false, kind: "read-failed" };
    if (session !== null) {
      if (a.state === "absent" || a.state === "inert" || a.state === "other") {
        return { ok: false, kind: "lost", reason: a.state === "other" ? "other-project" : "auth-cleared", currentId: p.id };
      }
      if (a.state === "ours") {
        if (a.session.userId !== userId) return { ok: false, kind: "lost", reason: "switched-account", currentId: p.id };
        const storedInst = a.instanceId || null;
        if (loginInstanceId !== null) {
          if (storedInst !== loginInstanceId) return { ok: false, kind: "lost", reason: "relogged-in", currentId: p.id };
        } else if (storedInst !== null) {
          return { ok: false, kind: "lost", reason: "relogged-in", currentId: p.id };
        }
      }
    } else if (a.state === "ours") {
      // session === null（如外项目迁移后的 need-login 态或只清理了凭证的半退出态）：只有存储里出现同项目可用凭证才说明另一页已重新登录
      return { ok: false, kind: "lost", reason: a.session.userId !== userId ? "switched-account" : "relogged-in", currentId: p.id };
    }
    return { ok: true, active: true };
  }
  // 跨标签页失权后只清理当前标签页内存态并通知上层切换 state，绝不覆盖共享存储里可能属于新登录实例的数据。
  function dropLostSession(reason = "logged-out") {
    const lostUserId = userId;
    dropVerified();
    bumpAcct();
    session = null; userId = null; email = ""; loginInstanceId = null; baseline = null; pending = false; waiting = null; lastSyncedAt = null;
    localRetryUser = null; localWritebackFails = 0; localRetryUnknown = false;
    setStatus(null);
    if (lostUserId) {
      try { onSessionLost({ userId: lostUserId, reason }); } catch {}
    }
  }
  function reconcileRestoreIssue() {
    if (restoreError()) {
      const owner = restoreOwner;
      const current = () => !userId && restoreOwner === owner && owner.gen === acctGen;
      const p = readCurrentAccount(storage);
      if (!current()) return staleResult();
      if (!p.ok) return { ok: false, kind: "local", message: "无法读取本机登录状态" };
      let changed = !p.id || !!(owner.uid && p.id !== owner.uid);
      if (!changed && owner.identity) {
        const a = inspectAuth();
        if (!current()) return staleResult();
        if (a.state === "read-failed") return { ok: false, kind: "local", message: "无法读取本机登录状态" };
        changed = !sameRestoreIdentity(owner.identity, restoreIdentity(a));
      }
      if (changed) { clearRestoreIssue(); return { ok: true, active: false, restoreChanged: true }; }
    }
    return { ok: true, active: false };
  }
  function reconcileSession() {
    if (!userId) return reconcileRestoreIssue();
    const own = checkSessionOwnership();
    if (own.ok) return { ok: true, active: true };
    if (own.kind === "read-failed") return { ok: false, kind: "local", message: "无法读取本机登录状态" };
    dropLostSession(own.reason);
    return { ok: false, kind: "session-lost", sessionLost: true, reason: own.reason, message: "登录状态已失效或已在其他页面切换" };
  }
  function persistLocal(state) {
    if (!userId) return { ok: false, code: "no-account" };
    const own = checkSessionOwnership();
    if (!own.ok) {
      if (own.kind === "lost") {
        dropLostSession(own.reason);
        return { ok: false, code: "session-lost", kind: "session-lost", sessionLost: true, reason: own.reason, message: "登录状态已失效或已在其他页面切换，未写入旧账号副本" };
      }
      return { ok: false, code: "read-failed", message: "无法确认本机登录状态" };
    }
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

  const localRetryKey = (uid) => `suipian.acct.writebackRetry.${uid}`;
  const cancelLocalRetry = () => { localRetryEpoch++; localRetryTimer = null; };
  function localFailureCount() {
    if (!userId) return 0;
    if (localRetryUser !== userId) {
      cancelLocalRetry(); localRetryUser = userId; localWritebackFails = 0;
    }
    // 同一浏览器的其他标签页、刷新后的页面读取同一上限。读取失败时自动同步保守停机，手动仍可尝试。
    try {
      const raw = storage.getItem(localRetryKey(userId));
      if (raw !== null) {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > LOCAL_RETRY_LIMIT) { localRetryUnknown = true; return LOCAL_RETRY_LIMIT; }
        if (localRetryUnknown) return LOCAL_RETRY_LIMIT;
        localWritebackFails = n; // 其他标签页手动恢复清零后，当前标签页也可恢复。
      }
    } catch { localRetryUnknown = true; return LOCAL_RETRY_LIMIT; }
    return localRetryUnknown ? LOCAL_RETRY_LIMIT : localWritebackFails;
  }
  function retryCounterWritable() {
    try {
      const key = localRetryKey(userId);
      const raw = storage.getItem(key);
      if (raw !== null && !/^[0-3]$/.test(raw)) { localRetryUnknown = true; return false; }
      const value = raw === null ? "0" : raw;
      storage.setItem(key, value); // 云端请求前确认计数器可写；不可写时自动停机。
      if (storage.getItem(key) !== value) throw new Error("retry counter did not persist");
      return !localRetryUnknown;
    } catch { localRetryUnknown = true; return false; }
  }
  function noteLocalWritebackFailure() {
    localWritebackFails = Math.min(LOCAL_RETRY_LIMIT, localFailureCount() + 1);
    try {
      storage.setItem(localRetryKey(userId), String(localWritebackFails));
      if (storage.getItem(localRetryKey(userId)) !== String(localWritebackFails)) throw new Error("retry counter did not persist");
    } catch {
      // 计数无法持久化时立即停止自动重试，防止新标签页继续轮询云端。
      localRetryUnknown = true; localWritebackFails = LOCAL_RETRY_LIMIT;
    }
    return localWritebackFails;
  }
  function resetLocalWritebackFailures() {
    const hadFailures = localWritebackFails > 0 || localFailureCount() > 0;
    cancelLocalRetry();
    if (!hadFailures) return true;
    // 清零必须写入并读回确认；否则另一个标签页仍看到旧上限，不能声称自动同步已恢复。
    try {
      storage.setItem(localRetryKey(userId), "0");
      if (storage.getItem(localRetryKey(userId)) !== "0") throw new Error("retry counter writeback mismatch");
      localWritebackFails = 0; localRetryUnknown = false;
      return true;
    } catch {
      localWritebackFails = LOCAL_RETRY_LIMIT; localRetryUnknown = true;
      return false;
    }
  }
  function autoRetryGuard() {
    const pi = loadPendingImport(storage, userId);
    if (!pi.ok || pi.record) return null; // 专用游客导入流程不受本任务上限影响。
    if (typeof window !== "undefined" && !retryLockHeld) {
      localRetryUnknown = true; return localRetryBlocked();
    }
    if (!retryCounterWritable() || localFailureCount() >= LOCAL_RETRY_LIMIT) return localRetryBlocked();
    return null;
  }
  const localRetryMessage = () => localRetryUnknown
    ? "本机同步重试计数无法确认，已暂停自动同步；请检查浏览器存储空间或权限，然后点击“立即同步”手动重试。"
    : "本机副本写回连续失败 3 次，已停止自动同步；原有进度仍在本机。请检查浏览器存储空间或权限，然后点击“立即同步”手动重试。";
  // 上限只拦截普通同步。专用游客导入待办仍由原流程处理，读取异常也保留原错误处理。
  function ordinaryAutoBlocked() {
    if (localFailureCount() < LOCAL_RETRY_LIMIT) return false;
    const pi = loadPendingImport(storage, userId);
    return pi.ok && !pi.record;
  }
  function localRetryBlocked() {
    pending = true;
    const message = localRetryMessage();
    setStatus("pending", message);
    return { ok: false, kind: "local", localWritebackFailed: true, retryLimitReached: true, retryable: false, message };
  }
  function scheduleLocalRetry() {
    const failures = localFailureCount();
    if (localRetryTimer !== null || failures < 1 || failures >= LOCAL_RETRY_LIMIT || !userId || !session) return;
    const delay = failures === 1 ? 3000 : 10000;
    const epoch = ++localRetryEpoch;
    localRetryTimer = schedule(() => {
      if (epoch !== localRetryEpoch) return;
      localRetryTimer = null;
      const count = localFailureCount();
      if (count > 0 && count < LOCAL_RETRY_LIMIT) syncNow();
    }, delay);
  }
  function scheduleSync(ms = 1500) {
    if (!userId || !session || importGuard() || ordinaryAutoBlocked()) return;
    if (timer) return;
    const g = acctGen;
    timer = schedule(() => { if (g !== acctGen) return; timer = null; syncNow(); }, ms);
  }

  // ---------- 同步：读云端 → 合并 → 带版本号写回；被抢先就重来 ----------
  // 手动入口只由账号卡片的“立即同步”传 manual:true；联网、可见性、跨标签触发和定时器一律是自动。
  // 顺序：无账号 → R1 损坏待办硬锁（手动也不能绕过）→ v4 本机写回重试上限（只拦自动）。
  function syncNow({ manual = false } = {}) {
    if (!userId) return Promise.resolve({ ok: false, kind: "no-account" });
    if (loggingOut || selfLogoutCleaning) return Promise.resolve(staleResult());
    const own = checkSessionOwnership();
    if (!own.ok) {
      if (own.kind === "lost") {
        dropLostSession(own.reason);
        return Promise.resolve({ ok: false, kind: "session-lost", sessionLost: true, retryable: false, reason: own.reason, message: "登录状态已失效或已在其他页面退出" });
      }
      return Promise.resolve({ ok: false, kind: "local", message: "无法确认本机登录状态" });
    }
    const guard = importGuard();
    if (guard) return Promise.resolve(guard);
    if (!manual && ordinaryAutoBlocked()) return Promise.resolve(localRetryBlocked());
    if (manual) cancelLocalRetry(); // 已排定的旧定时器不得在手动尝试后再重复读取云端。
    if (running) { again = true; return running; }
    const gen = acctGen;
    let mine;
    mine = running = (async () => {
      try {
        return await withLocalRetryLock(async () => {
        if (gen !== acctGen) return staleResult(); // 排队等锁期间已退出 / 换账号
        const lockOwn = checkSessionOwnership();
        if (!lockOwn.ok) {
          if (lockOwn.kind === "lost") { dropLostSession(lockOwn.reason); return staleResult(); }
          return { ok: false, kind: "local", message: "无法确认本机登录状态" };
        }
        if (!manual) {
          const blocked = autoRetryGuard();
          if (blocked) return blocked;
        }
        let r, joinedRetry = 0, replaced = false;
        for (;;) {
          again = false; r = await syncOnce({ manual, gen });
          if (r.stale || gen !== acctGen) return staleResult(); // 旧任务：不写状态、不安排重试、不动计数
          if (r.replacedLocal) replaced = true;
          if (r.ok) {
            netFails = 0;
            if (!resetLocalWritebackFailures()) {
              pending = true;
              const message = "本机同步重试计数无法清零；云端与本机进度已一致，但自动同步仍暂停。请检查浏览器存储权限并点击“立即同步”手动重试。";
              setStatus("pending", message);
              r = { ok: false, kind: "local", retryLimitReached: true, retryable: false, message };
              break;
            }
            if (again) continue;
            setStatus(pending ? "pending" : "synced");
            break;
          }
          if (r.retryLimitReached) break;
          if (r.localWritebackFailed) {
            cancelLocalRetry(); // 另一触发源提前失败时，废弃旧的 3 秒计时，从当前失败次数重新计时。
            const failures = noteLocalWritebackFailure();
            if (failures >= LOCAL_RETRY_LIMIT) {
              cancelLocalRetry();
              r = { ...r, ...localRetryBlocked() };
            } else {
              scheduleLocalRetry();
            }
            break; // 本机故障不进入网络退避，也不响应 again 立即再试。
          }
          if (r.kind === "network" || r.retryable) {
            // 联网了但这一轮因为“断网时发出的请求”失败：如果期间有人又要求同步（again），立刻再试一次，不能把旧的失败当成结果还给他
            if (again && joinedRetry++ < 1) continue;
            scheduleRetry(); // 否则退避重试，不要停在“离线”等下一次用户操作
          }
          break;
        }
        return replaced && r.ok ? { ...r, replacedLocal: true } : r;
        }, manual, gen);
      } finally { if (running === mine) running = null; } // 旧任务收尾只清自己的 running，不能清掉退出后新开的同步
    })();
    return mine;
  }
  function scheduleRetry() {
    if (retryTimer || !userId || !session || importGuard() || ordinaryAutoBlocked()) return;
    const delay = [3000, 10000, 30000, 60000][Math.min(netFails, 3)]; netFails++;
    const g = acctGen;
    retryTimer = schedule(() => { if (g !== acctGen) return; retryTimer = null; syncNow(); }, delay);
  }

  async function syncOnce({ manual = false, gen = acctGen } = {}) {
    const dead = () => gen !== acctGen;
    const lostDuringSync = () => {
      if (dead()) return staleResult();
      const own = checkSessionOwnership();
      if (own.ok) return null;
      if (own.kind === "lost") { dropLostSession(own.reason); return staleResult(); }
      return { ok: false, kind: "local", message: "无法确认本机登录状态" };
    };
    const initialLost = lostDuringSync();
    if (initialLost) return initialLost;
    // 必须早于 ensureToken()（它可能发出 refresh 请求）及任何云端读写。
    const initialGuard = importGuard();
    if (initialGuard) return initialGuard;
    setStatus("syncing");
    if (inCooldown()) {
      const limited = rateLimited();
      setStatus("error", limited.message, detailOf(limited));
      return limited;
    }
    if (!isSessionShape(session) || session.userId !== userId) {
      const miss = { ok: false, kind: "auth", message: "需要重新登录" };
      setStatus("need-login", miss.message);
      return miss;
    }
    const t = await ensureToken(gen);
    if (t.stale) return t;
    const afterTokenLost = lostDuringSync();
    if (afterTokenLost) return afterTokenLost;
    if (!t.ok) { noteRateLimit(t); setStatus(statusFromFailure(t), t.message, detailOf(t)); return t.kind === "rate-limit" ? { ...t, retryable: false } : t; }
    // 先重试“游客导入”专用待办，再跑普通同步。否则普通合并可能把云端旧 true 当成最新，
    // 让用户已经做过的选择永远写不上去。
    const pi = loadPendingImport(storage, userId);
    // refresh 是异步的：再次检查，避免刷新期间待办变坏后继续写云端。
    const afterTokenGuard = importGuard(pi);
    if (afterTokenGuard) return afterTokenGuard;
    if (pi.record) {
      const pr = await runPendingImport(pi.record, session, { notify: true, dead });
      const afterImportLost = lostDuringSync();
      if (afterImportLost) return afterImportLost;
      if (!pr.ok || pr.pending) {
        if (pr.kind === "import-corrupt" || pr.kind === "import-read-failed" || pr.kind === "import-changed") return { ...pr, retryable: false };
        pending = true;
        if (pr.kind === "rate-limit") { // 导入的读取 / 写入 / 读回收到 429：统一进同步冷却（不走网络短退避），状态保持“待同步”，未完成的待办留在本机
          noteRateLimit(pr);
          const limited = rateLimited();
          setStatus("pending", limited.message);
          return { ...limited, pendingImport: true };
        }
        setStatus(pr.kind === "auth" ? "need-login" : "pending", pr.error || pr.message || "游客导入还没同步完，联网后会自动重试");
        return { ok: false, kind: pr.kind || "verify", message: pr.error || pr.message || "游客导入还没同步完", pendingImport: true, retryable: pr.kind !== "local" && pr.kind !== "data" && pr.kind !== "conflict" && pr.kind !== "auth" };
      }
    }
    if (!manual) {
      const blocked = autoRetryGuard();
      if (blocked) return blocked;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const remote = await api.getProgress(session);
      const afterGetLost = lostDuringSync();
      if (afterGetLost) return afterGetLost;
      const midFlightGuard = importGuard();
      if (midFlightGuard) return midFlightGuard;
      if (!remote.ok) { noteRateLimit(remote); setStatus(statusFromFailure(remote), remote.message, detailOf(remote)); return remote.kind === "rate-limit" ? { ...remote, retryable: false } : remote; }
      const L = loadAccount(storage, userId, { now: now() });
      if (!L.ok || !L.copy) { setStatus("error", "本机账号记录读取失败"); return { ok: false, kind: "local", message: "本机账号记录读取失败" }; }
      const copy = L.copy;
      let finalDoc, rev, replaced = false, cloudWriteConfirmed = false;
      if (!remote.row) {
        const beforeCreateLost = lostDuringSync();
        if (beforeCreateLost) return beforeCreateLost;
        const beforeCreateGuard = importGuard();
        if (beforeCreateGuard) return beforeCreateGuard;
        const c = await api.createProgress(session, copy.doc);
        const afterCreateLost = lostDuringSync();
        if (afterCreateLost) return afterCreateLost;
        const afterCreateGuard = importGuard();
        if (afterCreateGuard) return afterCreateGuard;
        if (!c.ok) { noteRateLimit(c); setStatus(statusFromFailure(c), c.message, detailOf(c)); return c.kind === "rate-limit" ? { ...c, retryable: false } : c; }
        if (c.rev === null) continue; // 刚好有别的设备抢先创建了：重新读
        finalDoc = copy.doc; rev = c.rev; cloudWriteConfirmed = true;
      } else {
        const m = mergeDocs(copy.doc, remote.row.doc, { localHeartsDirty: copy.dirty.hearts, localPrefsDirty: copy.dirty.prefs });
        if (m.error) { setStatus("error", m.error.message, { kind: "data", code: m.error.code }); return { ok: false, kind: "data", code: m.error.code, message: m.error.message }; }
        if (m.outcome === "conflict") { setStatus("conflict"); return { ok: false, kind: "conflict", message: "这个账号在别处被“覆盖”过，需要选择保留哪一份" }; }
        finalDoc = m.doc; rev = remote.row.rev;
        if (m.outcome === "remote-newer" && copy.dirty.content) replaced = true;
        if (!docsEquivalent(finalDoc, remote.row.doc)) {
          const beforeSaveLost = lostDuringSync();
          if (beforeSaveLost) return beforeSaveLost;
          const beforeSaveGuard = importGuard();
          if (beforeSaveGuard) return beforeSaveGuard;
          const s = await api.saveProgress(session, remote.row.rev, finalDoc);
          const afterSaveLost = lostDuringSync();
          if (afterSaveLost) return afterSaveLost;
          const afterSaveGuard = importGuard();
          if (afterSaveGuard) return afterSaveGuard;
          if (!s.ok) { noteRateLimit(s); setStatus(statusFromFailure(s), s.message, detailOf(s)); return s.kind === "rate-limit" ? { ...s, retryable: false } : s; }
          if (s.rev === null) continue; // 被抢先：重新读、合并、再写
          rev = s.rev; cloudWriteConfirmed = true;
        }
      }
      const beforeWritebackLost = lostDuringSync();
      if (beforeWritebackLost) return beforeWritebackLost;
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
      const localSaved = saveAccount(storage, userId, { doc: saveDoc, base: rev, dirty }, { now: now() });
      if (!localSaved) {
        pending = true;
        const message = cloudWriteConfirmed
          ? "进度已保存在云端，但本机副本写回失败；原有副本已保留，稍后自动重试"
          : "本机副本写回失败；原有副本已保留，稍后自动重试";
        setStatus("pending", message);
        return { ok: false, kind: "local", retryable: true, localWritebackFailed: true, rev, message };
      }
      if (!docsEquivalent(curCopy.doc, saveDoc)) { // 云端带来了本机没有的内容：用合并后的结果刷新应用状态，并把“新挣的 XP”的基准同步成新的总数
        const ns = docToState(saveDoc, null, now());
        baseline = { xp: ns.xp, lessonsCompleted: ns.lessonsCompleted };
        onState(saveDoc);
      }
      pending = again;
      // 等待外层确认计数器清零后才允许宣称“已同步”。
      setStatus(again ? "pending" : "syncing");
      if (replaced) { try { onNotice("replaced", {}); } catch {} }
      return replaced ? { ok: true, rev, replacedLocal: true } : { ok: true, rev };
    }
    // 五次都被抢先：停在这里，不安排下一轮盲目重试。本机副本保持脏 / 待同步，用户或下次手动同步还能再传。
    pending = true;
    setStatus("error", "同步冲突太多次，请稍后再试");
    return { ok: false, kind: "server", retryable: false, message: "同步冲突太多次，请稍后再试" };
  }

  // ---------- 登录 ----------
  // captchaToken（可选，D 防滥用的准备）：只作为本次请求的参数原样交给 api，不在这里保存、不缓存、不记录；
  // 账号隔离（loginBlocked）和冷却检查都在它之前，被拦下时不会发出任何请求，也不会碰令牌。
  function captureLoginStart() {
    const acc = readCurrentAccount(storage);
    if (!acc.ok) return { ok: false };
    const a = inspectAuth();
    if (a.state === "read-failed") return { ok: false };
    const inst = a.state === "ours" || a.state === "other" ? (a.instanceId || null) : null;
    return { ok: true, sid: acc.id, instanceId: inst };
  }
  async function sendCode(addr, captchaToken) {
    if (userId) reconcileSession();
    const blocked = loginBlocked(addr);
    if (blocked) return blocked;
    dropVerified(); // 重发验证码 = 开始新的一轮：之前“已验证待读取”的会话作废
    // 冷却期内不再调用发信接口。测试只用假接口，这里也不会向任何真实邮箱发验证码。
    // 返回元数据（G-LOGIN-06）：retryAt = 实际门禁截止时间（发码冷却与同步冷却的较大值），waitMs = 此刻剩余等待，localBlock = 这次是否在本地被挡（没发请求）。界面按它们倒计时，不自己重算。
    const gate = (res, localBlock) => ({ ...res, retryAt: coolUntil(), waitMs: Math.max(0, coolUntil() - now()), localBlock });
    if (inCooldown()) return gate(rateLimited(), true);
    const r = await (captchaToken ? api.sendCode(String(addr).trim(), captchaToken) : api.sendCode(String(addr).trim())); // 没有令牌时调用形状和以前完全一致
    if (r && r.kind === "rate-limit") { armCooldown(r); return gate(r, false); }
    return r;
  }

  // 验证码 → 会话；然后看游客记录需不需要用户选择
  const discarded = () => ({ ok: false, kind: "stale", discarded: true, message: "" });
  function dropVerified() { verifyGen++; verified = null; }
  async function verify(addr, code, baseState = null) {
    if (userId) reconcileSession();
    const blocked = loginBlocked(addr);
    if (blocked) return blocked;
    const mail = normalizedEmail(addr), c = String(code).trim();
    // 同一个邮箱、同一个码、而且验证已经通过：码已经被用掉，不再调用验证接口，只重试读取（和「重试读取」按钮同一条路）。
    if (verified && verified.email === mail && verified.code === c && now() < verified.expiresAt) return retryRead(baseState);
    const gen = ++verifyGen; verified = null; // 新的一轮：旧的待读取会话作废，之后任何迟到的旧响应都按代次丢弃
    const r = await api.verifyCode(String(addr).trim(), code);
    if (gen !== verifyGen) return discarded(); // 请求在途时换了邮箱 / 重发 / 关窗：迟到的结果不要
    if (!r.ok) return r;
    const isCurrent = () => gen === verifyGen;
    const out = await begin(r.session, baseState, { isCurrent });
    if (out.discarded || out.ok || out.stage !== "read") return out;
    // 验证码对了、读云端记录没成功：留住已验证会话，让用户重试读取
    const v = { session: r.session, email: mail, userId: r.session.userId, code: c, gen, baseState, reads: 1, inflight: null, expiresAt: Math.min(now() + VERIFIED_TTL_MS, (Number(r.session.expiresAt) || Infinity) - 60_000) };
    return noteReadFailure(v, out);
  }
  // 读失败之后：还能重试吗？（总次数 / 时限）能就留住会话并带上 canRetry:true，不能就作废并带上 canRetry:false
  function noteReadFailure(v, r) {
    const authClass = r.kind === "auth" || r.status === 401 || r.status === 403;
    const tries = authClass ? READ_TRIES_AUTH : READ_TRIES_OTHER;
    const expired = now() >= v.expiresAt;
    if (expired || v.reads >= tries) { if (verified === v || !verified) { verified = null; } return { ...r, canRetry: false, ...(expired ? { expired: true } : { exhausted: true }) }; }
    verified = v;
    // 读云端被 429：这一轮会话要等到服务器给的时间之后才能再读（Retry-After 的解析和最短 5 秒 / 保底 60 秒都和普通同步共用 cooldownMsFrom）。
    // 等待记在已验证会话 v 上：关窗 / 改验证码 / 换邮箱 / 重发 / 退出 / 登录完成都会丢掉 v，等待随之作废，不会带到下一次登录；
    // 它不延长 v.expiresAt（会话到期照旧作废，等待跨过到期 → 转“不能再重试”），被 429 的这次读取照常记进 reads（不额外多算也不少算）。
    if (r.kind === "rate-limit" || r.status === 429) {
      v.waitUntil = Math.max(v.waitUntil || 0, now() + cooldownMsFrom(r));
      return { ...r, canRetry: true, retryAt: v.waitUntil, waitMs: Math.max(0, v.waitUntil - now()) };
    }
    return { ...r, canRetry: true };
  }
  // 「重试读取」：不调用验证接口，只用留着的已验证会话再读一次云端；成功后和正常登录完全一样（游客处理、落盘凭证、同步）。
  async function retryRead(baseState = null) {
    const v = verified;
    if (!v) return { ok: false, kind: "auth", stage: "read", canRetry: false, expired: true, message: "已验证的登录已失效，请重新发送验证码" };
    if (now() >= v.expiresAt) { verified = null; return { ok: false, kind: "auth", stage: "read", canRetry: false, expired: true, message: "已验证的登录已失效，请重新发送验证码" }; }
    if (v.inflight) return v.inflight; // 连点：共用同一次读取，不重复处理、不重复计分
    // 上一次读取被 429 且等待还没结束：不发请求、不计入读取次数（v.reads 不动）、不改会话到期时间；只把剩余等待报回去。直接调用 / 同一个码再登录都走这里。
    if (v.waitUntil && now() < v.waitUntil) return { ok: false, kind: "rate-limit", stage: "read", canRetry: true, retryable: false, retryAt: v.waitUntil, waitMs: v.waitUntil - now(), message: "读取太频繁了，请等一会儿再重试读取。" };
    const expiredResult = () => ({ ok: false, kind: "auth", stage: "read", canRetry: false, expired: true, message: "已验证的登录已失效，请重新发送验证码" });
    const run = (async () => {
      v.reads++;
      // 读取返回后、切账号 / 写凭证之前再复查一次：流程被作废（换邮箱 / 重发 / 关窗 / 退出）→ 丢弃；只是到期 → 作废并按“已失效”返回（成功的响应也不能在到期后完成登录）
      const stillOurs = () => verified === v && v.gen === verifyGen;
      const out = await begin(v.session, baseState ?? v.baseState, { isCurrent: () => stillOurs() && now() < v.expiresAt });
      if (out.discarded) { if (stillOurs()) { verified = null; return expiredResult(); } return out; }
      if (out.ok) { if (verified === v) verified = null; return out; }
      if (out.stage === "read") return noteReadFailure(v, out);
      if (verified === v) verified = null; // 数据 / 本机副本 / 账号冲突等：重读也不会好，作废
      return out;
    })();
    v.inflight = run;
    try { return await run; } finally { v.inflight = null; }
  }

  async function begin(newSession, baseState, { isCurrent = null } = {}) {
    if (!isSessionShape(newSession)) return { ok: false, kind: "auth", message: "登录返回的凭证无效" };
    if (userId) reconcileSession();
    // 换了 Supabase 项目后旧登录作废：用“同一个邮箱”可以在新项目正常登录，但只加载新项目自己的进度。
    // 旧项目的账号副本和游客记录原样留在本机，既不上传到新项目、也不删除（数据隔离规则）。换成别的邮箱仍要先退出。
    let leaveStale = false;
    if (userId && userId !== newSession.userId) {
      const st = readStale(), mail = normalizedEmail(newSession.email);
      if (!session && st && st.userId === userId && st.email && normalizedEmail(st.email) === mail) leaveStale = true;
      else return { ok: false, kind: "other-account", message: "请先退出当前账号" };
    }
    const startSnap = captureLoginStart();
    if (!startSnap.ok) return { ok: false, kind: "local", message: "无法读取本机登录状态" };
    if (startSnap.sid && startSnap.sid !== newSession.userId && !leaveStale) {
      return { ok: false, kind: "other-account", message: "请先退出当前账号" };
    }
    const remote = await api.getProgress(newSession);
    if (isCurrent && !isCurrent()) return discarded(); // 读云端期间这一轮登录已被作废（换邮箱 / 重发 / 关窗）：丢弃，不切账号、不写任何东西
    // stage:"read"：验证码这一步已经通过（邮箱验证码是一次性的，已经被用掉），只是随后读云端记录失败、登录没有完成。
    // 调用方（verify / retryRead）据此留住已验证会话，界面提示「重试读取」；不能让用户拿同一个码再验证一次（那会报“验证码错误或已过期”）。
    if (!remote.ok) return { ...remote, stage: "read" };
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
    const ctx = { session: newSession, remote, remoteDoc: remoteDoc ? remoteDoc.doc : null, copy: L.copy, guest, guestHas, baseState, leaveStale, expectedLogin: { sid: startSnap.sid, instanceId: startSnap.instanceId } };
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
    resumeChoiceOp = null; // G-LOGIN-04：用户已提交选择，尚在读取的旧恢复不得再替换它
    if (ctx.resume) {
      // “恢复后重新选择”：弹窗期间令牌可能已被刷新轮换，必须用当前会话，不能把挂起时那份旧令牌写回去。
      if (!session || !userId || userId !== ctx.session.userId) { waiting = null; return { ok: false, kind: "auth", message: "登录状态已变化，请重新操作" }; }
      const gen0 = acctGen;
      const tk = await ensureToken(); // 先刷新（若需要），再取“刷新之后的当前会话”：后面所有联网和收尾写回都用同一个对象，不会把旧令牌写回存储
      if (gen0 !== acctGen) return staleImport(); // 刷新期间已退出 / 换账号
      if (!tk.ok) return tk;          // 保留 waiting：用户可以稍后在同一个弹窗里重试
      ctx.session = session;
    }
    const r = await finish(ctx, choice);
    if (r.stale) return r; // 选择过程中已退出 / 换账号：旧任务整体作废，不碰 waiting（可能已是新登录的），也不回读本机副本
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

  // ---------- 损坏导入待办的恢复（只在本机、不联网）----------
  // 当前状态的只读描述，给界面决定显示什么：corrupt（确认损坏，可隔离）| read-failed（读不出来，只能重试）| healthy | none。
  function pendingRecoveryInfo() {
    if (!userId) return { state: "none" };
    const r = readPendingImportRaw(storage, userId);
    if (!r.ok) return { state: "read-failed" };
    if (r.raw === null) return { state: "none" };
    const pi = parsePendingImport(r.raw, userId);
    if (pi.ok) return { state: "healthy" };
    if (pi.code !== "corrupt") return { state: "read-failed" };
    return { state: "corrupt", digest: rawDigest(r.raw), bytes: r.raw.length };
  }
  // 隔离：把确认损坏的待办原文备份（读回确认）→ 再删除原待办。游客记录、账号副本、登录凭证一概不动；全程零网络请求。
  // 每一步前后都核对“还是同一个账号、还是同一份原文”：被别的标签页替换就立刻停，不删任何东西。
  // 任何失败都保留原文，返回 ok:false，绝不让界面说“已恢复”。
  async function quarantinePendingImport({ expectedDigest = null } = {}) {
    const fail = (kind, message, extra = {}) => ({ ok: false, kind, message, quarantined: false, originalKept: true, ...extra });
    if (!userId) return fail("no-account", "没有登录的账号");
    if (running) return fail("busy", "正在同步，请稍后再试");
    const uid = userId;
    const sameAccount = () => { const p = readCurrentAccount(storage); return userId === uid && p.ok && p.id === uid; };
    if (!sameAccount()) return fail("account-changed", "登录的账号已变化，没有处理待办");
    const r1 = readPendingImportRaw(storage, uid);
    if (!r1.ok) return fail("read-failed", "无法读取游客导入待办。这只是读取失败，不是确认损坏：请检查浏览器存储权限后重试，没有隔离任何内容。");
    if (r1.raw === null) return fail("no-pending", "当前没有游客导入待办，不需要处理");
    const raw = r1.raw;
    const parsed = parsePendingImport(raw, uid);
    if (parsed.ok) return fail("not-corrupt", "游客导入待办是完好的，不需要隔离");
    if (parsed.code !== "corrupt") return fail("read-failed", "无法确认待办是否损坏，没有隔离任何内容");
    const digest = rawDigest(raw);
    if (expectedDigest && expectedDigest !== digest) return fail("pending-changed", "游客导入待办在你确认之后又变了，没有处理。请重新查看再确认。");
    const bk = backupCorruptPending(storage, uid, raw, { now: now() });
    if (!bk.ok) return fail("backup-failed", "损坏的待办没能备份（" + bk.code + "），所以没有动它；本机数据都还在。");
    // 备份落盘后、删除前，再核对一次：账号没换、待办原文还是这一份。
    if (!sameAccount()) return fail("account-changed", "登录的账号刚刚变了，已停止；原待办没动", { backedUp: true });
    const r2 = readPendingImportRaw(storage, uid);
    if (!r2.ok) return fail("read-failed", "备份后再次读取待办失败，已停止；原待办没动", { backedUp: true });
    if (r2.raw !== raw) return fail("pending-changed", "游客导入待办刚刚被其他页面替换，已停止；没有删除任何待办", { backedUp: true });
    let removeThrew = false;
    try { storage.removeItem(PENDING_IMPORT_PREFIX + uid); } catch { removeThrew = true; }
    const r3 = readPendingImportRaw(storage, uid);
    if (!r3.ok) return fail("remove-unverified", "删除后无法读回确认，没有当作已恢复；备份已保留", { backedUp: true });
    if (r3.raw === raw) return fail("remove-failed", removeThrew ? "原待办删除失败，仍保留在本机；备份已保留" : "原待办没有删掉，仍保留在本机；备份已保留", { backedUp: true });
    pending = true;
    setStatus("pending", "已备份并移除损坏的游客导入待办。请重新确认游客进度怎么处理。");
    return { ok: true, quarantined: true, originalKept: false, digest, bytes: raw.length, reusedBackup: !!bk.reused, replacedByOtherTab: r3.raw !== null,
      message: "损坏的待办已备份到本机并移除。游客记录、账号副本和登录都没动。接下来请重新确认游客进度怎么处理。" };
  }
  // 隔离之后重新走“游客进度怎么处理”：读最新云端 → 按指纹判断（已导入过 / 没导入过 / 游客又有新进度）。
  //   已导入过或游客没有学习记录 → 不需要选择，直接做一次手动同步；否则返回 needChoice，和登录时的选择完全同一条路（finishChoice）。
  async function resumeGuestImportChoice(baseState = null) {
    if (!userId || !session) return { ok: false, kind: "auth", message: "需要先登录" };
    const g = importGuard(); if (g) return g;
    if (running) return { ok: false, kind: "busy", message: "正在同步，请稍后再试" };
    const op = { gen: acctGen, uid: userId, inst: loginInstanceId, verifyGen, waiting };
    resumeChoiceOp = op;
    const guardResumeChoice = () => {
      // 先判本页操作身份：旧任务不能借复查共享存储去清掉新登录 / 新选择。
      if (resumeChoiceOp !== op || op.gen !== acctGen || op.uid !== userId || op.inst !== loginInstanceId || op.verifyGen !== verifyGen || op.waiting !== waiting) return staleImport();
      const own = checkSessionOwnership();
      if (!own.ok) {
        if (own.kind === "lost") { dropLostSession(own.reason); return staleImport(); }
        return { ok: false, kind: "local", message: "无法确认本机登录状态" };
      }
      return importGuard();
    };
    try {
      const beforeToken = guardResumeChoice(); if (beforeToken) return beforeToken;
      const t = await ensureToken(op.gen);
      const afterToken = guardResumeChoice(); if (afterToken) return afterToken;
      if (!t.ok) return t;
      const startSnap = captureLoginStart();
      if (!startSnap.ok) return { ok: false, kind: "local", message: "无法读取本机登录状态" };
      const sess = session, uid = op.uid;
      const remote = await api.getProgress(sess);
      const afterRead = guardResumeChoice(); if (afterRead) return afterRead;
      if (!remote.ok) return remote;
      const remoteDoc = remote.row ? normalizeDoc(remote.row.doc) : null;
      if (remoteDoc && !remoteDoc.ok) return { ok: false, kind: "data", code: remoteDoc.code, message: "云端记录：" + remoteDoc.message };
      const L = loadAccount(storage, uid, { now: now() });
      if (!L.ok) return { ok: false, kind: "local", message: L.message };
      const guest = readGuest(storage);
      const guestHas = guest.status === "ok" && guestHasLearning(guest.state);
      const gid = getGuestId(storage);
      const importStatus = remoteDoc && gid.ok ? guestImportStatus(remoteDoc.doc, gid.id, guest.state) : "new";
      const beforeChoice = guardResumeChoice(); if (beforeChoice) return beforeChoice;
      if (!guestHas || importStatus === "same") {
        const r = await syncNow({ manual: true });
        const afterSync = guardResumeChoice(); if (afterSync) return afterSync;
        if (r.stale) return r;
        return { ok: r.ok, noChoiceNeeded: true, alreadyImported: importStatus === "same", sync: r, message: r.ok ? "" : r.message };
      }
      waiting = { session: sess, remote, remoteDoc: remoteDoc ? remoteDoc.doc : null, copy: L.copy, guest, guestHas, baseState, leaveStale: false, resume: true, expectedLogin: { sid: startSnap.sid, instanceId: startSnap.instanceId } };
      return { ok: true, needChoice: true, resume: true, cloudHasData: !!remoteDoc && sumXp(remoteDoc.doc) + Object.keys(remoteDoc.doc.done).length > 0,
        guest: { xp: guest.state.xp ?? 0, lessons: Object.keys(guest.state.done ?? {}).filter((k) => guest.state.done[k]).length } };
    } finally {
      if (resumeChoiceOp === op) resumeChoiceOp = null;
    }
  }

  // 登录弹窗挂起期间，别的设备可能已经往云端写了新进度。所有实际写入前都必须重新读最新云端，
  // 不能复用验证码登录时那份旧 remoteDoc。返回规范化文档 + 原始文档（只写指纹时要逐字保留其他字段）。
  // 游客导入的会话来源（G-LOGIN-13）：src = { sess, active, gen, uid }，由 runPendingImport 在入口建立。
  //   active（已登录实例：同步重试待办 / 恢复后重新选择）：每次联网前先 ensureToken(gen)（同步同实例其他标签页的轮换、必要时刷新、复查登录所有权），
  //     再取“刷新之后的当前会话”，并回写 src.sess；后面的读取 / 创建 / 保存 / 读回都用它，绝不再用刷新前的旧对象。
  //   非 active（验证码登录尚未设全局 session）：只用刚验证得到的 ctx.session，不借用全局 session。
  async function useSession(src, dead = () => false) {
    if (!src || !src.sess) return { ok: false, kind: "auth", message: "需要重新登录" };
    if (!src.active) {
      // 验证码登录尚未提交：用刚验证得到的独立会话，不借用全局 session。它在等待选择 / 冲突重读期间也会过期：这里局部刷新，
      // 新凭证立刻交回登录选择（onSession），后续重试和最终提交都用它；刷新前后都复核登录实例，被其他页取代就停（G-LOGIN-13）。
      if (!Number.isFinite(src.sess.expiresAt) || src.sess.expiresAt - now() > 60000) return { ok: true, session: src.sess };
      const pre = src.guard(); if (pre) return pre;
      const rf = await api.refresh(src.sess);
      const post = src.guard(); if (post) return post;
      if (!rf.ok) return rf;
      if (!isSessionShape(rf.session) || rf.session.userId !== src.uid) return { ok: false, kind: "auth", message: "登录账号不一致" };
      src.sess = rf.session;
      try { src.onSession?.(rf.session); } catch {}
      return { ok: true, session: src.sess };
    }
    if (dead() || src.gen !== acctGen) return staleImport();
    const t = await ensureToken(src.gen);
    if (dead() || src.gen !== acctGen || t.stale) return staleImport(); // 刷新期间已退出 / 换账号 / 同号重登：不借新会话继续旧任务
    if (!t.ok) return t;
    if (!isSessionShape(session) || session.userId !== src.uid) return { ok: false, kind: "auth", message: "需要重新登录" };
    src.sess = session;
    return { ok: true, session };
  }
  async function readLatestCloud(src, dead = () => false) {
    const k = await useSession(src, dead);
    if (!k.ok) return k;
    const r = await api.getProgress(k.session);
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
  const staleImport = () => ({ ok: false, kind: "stale", stale: true, retryable: false, message: "账号已退出或切换，这次游客导入的结果已丢弃" });
  async function writeKeepCloud(uid, guestId, guestState, fingerprint, src, dead = () => false) {
    if (dead()) return staleImport();
    const first = loadAccount(storage, uid, { now: now() });
    if (!first.ok) return { ok: false, kind: "local", message: first.message || "本机账号记录读取失败" };
    let latest = await readLatestCloud(src, dead);
    if (dead()) return staleImport(); // 旧任务（退出 / 换账号之后才回来）：不再发后续请求，不写本机副本、不清游客、不改状态
    if (!latest.ok) return { ...latest, pending: true };
    let doc = null, rev = null, uploaded = false, error = "", kind = null, lastBase = null, lastCloud = null, raSec;
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
        const k = await useSession(src, dead);
        if (dead() || k.stale) return staleImport();
        if (!k.ok) { error = k.message || "保存失败"; kind = k.kind; raSec = k.retryAfterSec; break; }
        const c = await api.createProgress(k.session, doc);
        if (dead()) return staleImport();
        if (!c.ok) { error = c.message || "保存失败"; kind = c.kind; raSec = c.retryAfterSec; break; }
        if (c.rev === null) { latest = await readLatestCloud(src, dead); if (dead()) return staleImport(); if (!latest.ok) return { ...latest, pending: true }; continue; } // 被抢先创建：重读
        rev = c.rev; uploaded = true; break;
      }
      const k = await useSession(src, dead);
      if (dead() || k.stale) return staleImport();
      if (!k.ok) { error = k.message || "保存失败"; kind = k.kind; raSec = k.retryAfterSec; break; }
      const s = await api.saveProgress(k.session, latest.row.rev, doc);
      if (dead()) return staleImport();
      if (!s.ok) { error = s.message || "保存失败"; kind = s.kind; raSec = s.retryAfterSec; break; }
      if (s.rev === null) { latest = await readLatestCloud(src, dead); if (dead()) return staleImport(); if (!latest.ok) return { ...latest, pending: true }; continue; } // CAS 冲突：重读再写
      rev = s.rev; uploaded = true; break;
    }
    if (!uploaded) {
      const lostBefore = src.guard(); if (lostBefore) return lostBefore; // 请求返回后、写本机副本之前：共享登录实例已被其他页取代就停，不动存储
      // 五次都是被抢先（没有别的错误种类）：停止盲目重试。网络错误仍保留原来的 kind，允许稍后重试。
      if (!kind) kind = "conflict";
      // 写指纹失败：云端原样、游客原样；本机副本只保存“最新云端 + 本机新学的”，不带新指纹。
      const base = lastCloud ?? (first.copy?.doc ?? emptyDoc());
      const p = preserveLocalChanges(uid, base, lastCloud);
      const localDoc = p.ok ? p.doc : base;
      const dirty = first.copy ? first.copy.dirty : cleanDirty;
      if (!saveLoginCopy(uid, localDoc, lastBase, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ok: true, doc: localDoc, rev: lastBase, synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind, error: error || "保存游客指纹失败", ...(raSec !== undefined ? { retryAfterSec: raSec } : {}) };
    }
    // 上传成功不等于完成：必须重新读回，确认文档一致且新指纹确实在云端。
    let verified = false, readBack = null, rbKind = null, rbError = "", rbRa;
    const rk = await useSession(src, dead); // 写入成功后读回：同样先取刷新之后的当前会话
    if (dead() || rk.stale) return staleImport();
    const rb = rk.ok ? await api.getProgress(rk.session) : rk;
    if (dead()) return staleImport();
    if (!rb.ok) { rbKind = rb.kind; rbError = rb.message || "读回失败"; rbRa = rb.retryAfterSec; }
    else if (!rb.row) { rbKind = "data"; rbError = "读回时云端记录不见了"; }
    else {
      const n = normalizeDoc(rb.row.doc);
      if (!n.ok) { rbKind = "data"; rbError = "云端记录：" + n.message; }
      else { readBack = n.doc; verified = docsEquivalent(doc, n.doc) && n.doc.imported[guestId] === fingerprint; }
    }
    const lostAfterRead = src.guard(); if (lostAfterRead) return lostAfterRead; // 读回返回后、写副本 / 清游客 / 清待办之前复核登录实例
    if (!verified) {
      const p = preserveLocalChanges(uid, doc, lastCloud);
      const localDoc = withoutGuestImport(p.ok ? p.doc : doc, guestId, lastCloud);
      const dirty = first.copy ? first.copy.dirty : cleanDirty;
      if (!saveLoginCopy(uid, localDoc, rev, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ok: true, doc: localDoc, rev, synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind: rbKind || "verify", ...(rbRa !== undefined ? { retryAfterSec: rbRa } : {}), error: rbError || "上传成功，但读回校验失败，游客记录已保留" };
    }
    if (!saveLoginCopy(uid, readBack, rev, cleanDirty, false)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
    return { ok: true, doc: readBack, rev, synced: true, verified: true, guestCleared: false, saved: true, pending: false, error: "" };
  }

  // 选“安全合并”：重读最新云端 → 以云端为底合并游客 XP/次数（按设备取较大值）、关卡/日期并集 →
  // CAS 写入 → 读回与上传文档一致才允许删游客。冲突重读再合并再写，绝不 gen + 1 整份覆盖。
  async function writeMergeGuest(uid, deviceId, record, src, expectedRaw, dead = () => false) {
    if (dead()) return staleImport();
    const guestId = record.guestId, guestState = record.guestState;
    const first = loadAccount(storage, uid, { now: now() });
    if (!first.ok) return { ok: false, kind: "local", message: first.message || "本机账号记录读取失败" };
    let current = await readLatestCloud(src, dead);
    if (dead()) return staleImport();
    if (!current.ok) return { ...current, pending: true };
    let doc = null, rev = null, uploaded = false, error = "", kind = null, lastBase = null, lastCloud = null, raSec;
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
        const k = await useSession(src, dead);
        if (dead() || k.stale) return staleImport();
        if (!k.ok) { error = k.message || "保存失败"; kind = k.kind; raSec = k.retryAfterSec; break; }
        const c = await api.createProgress(k.session, doc);
        if (dead()) return staleImport();
        if (!c.ok) { error = c.message || "上传失败"; kind = c.kind; raSec = c.retryAfterSec; break; }
        if (c.rev === null) { current = await readLatestCloud(src, dead); if (dead()) return staleImport(); if (!current.ok) return { ...current, pending: true }; continue; } // 被抢先创建：重读、重新合并
        rev = c.rev; uploaded = true; break;
      }
      const k = await useSession(src, dead);
      if (dead() || k.stale) return staleImport();
      if (!k.ok) { error = k.message || "上传失败"; kind = k.kind; raSec = k.retryAfterSec; break; }
      const s = await api.saveProgress(k.session, current.row.rev, doc);
      if (dead()) return staleImport();
      if (!s.ok) { error = s.message || "上传失败"; kind = s.kind; raSec = s.retryAfterSec; break; }
      if (s.rev === null) { current = await readLatestCloud(src, dead); if (dead()) return staleImport(); if (!current.ok) return { ...current, pending: true }; continue; } // CAS 冲突：重读、重新合并
      rev = s.rev; uploaded = true; break;
    }
    if (!uploaded) {
      const lostBefore = src.guard(); if (lostBefore) return lostBefore; // 请求返回后、写本机副本之前：共享登录实例已被其他页取代就停，不动存储
      // 五次都是被抢先：kind 标成 conflict，同步层不会把它当成可盲目重试的网络错误。
      if (!kind) kind = "conflict";
      // 上传失败 / 冲突太多次：游客原文保留；本机副本保留合并结果（不带未确认的新指纹）并标记待上传。
      const localDoc = withoutGuestImport(doc, guestId, lastCloud);
      const dirty = { hearts: !!first.copy?.dirty.hearts, prefs: !!first.copy?.dirty.prefs, content: true };
      if (!saveLoginCopy(uid, localDoc, lastBase, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ok: true, doc: localDoc, rev: lastBase, synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind, error: error || "合并冲突太多次，请稍后再试", ...(raSec !== undefined ? { retryAfterSec: raSec } : {}) };
    }
    // 上传成功不等于读回一致：必须重新读云端，文档与刚上传的完全一致才删游客。
    let verified = false, readBack = null, rbKind = null, rbError = "", rbRa;
    const rk = await useSession(src, dead); // 写入成功后读回：同样先取刷新之后的当前会话
    if (dead() || rk.stale) return staleImport();
    const rb = rk.ok ? await api.getProgress(rk.session) : rk;
    if (dead()) return staleImport();
    if (!rb.ok) { rbKind = rb.kind; rbError = rb.message || "读回失败"; rbRa = rb.retryAfterSec; }
    else if (!rb.row) { rbKind = "data"; rbError = "读回时云端记录不见了"; }
    else {
      const n = normalizeDoc(rb.row.doc);
      if (!n.ok) { rbKind = "data"; rbError = "云端记录：" + n.message; }
      else { readBack = n.doc; verified = docsEquivalent(doc, n.doc); }
    }
    const lostAfterRead = src.guard(); if (lostAfterRead) return lostAfterRead; // 读回返回后、写副本 / 清游客 / 清待办之前复核登录实例
    if (!verified) {
      const localDoc = withoutGuestImport(doc, guestId, lastCloud);
      const dirty = { hearts: !!first.copy?.dirty.hearts, prefs: !!first.copy?.dirty.prefs, content: true };
      if (!saveLoginCopy(uid, localDoc, rev, dirty, !first.copy)) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
      return { ok: true, doc: localDoc, rev, synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind: rbKind || "verify", ...(rbRa !== undefined ? { retryAfterSec: rbRa } : {}), error: rbError || "上传成功，但读回校验失败，游客记录已保留" };
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
  async function runPendingImport(record, sess, { notify = false, dead = () => false, check = null, onSession = null } = {}) {
    const uid = record.userId;
    let expectedRaw;
    try { expectedRaw = storage.getItem(PENDING_IMPORT_PREFIX + uid); }
    catch { return importGuard({ ok: false, code: "read-failed" }, uid); }
    const startGuard = pendingIdentityGuard(uid, record, expectedRaw);
    if (startGuard) return startGuard;
    // 会话来源在入口一次定好：传入的就是当前登录会话 → 已登录实例（active）；否则是登录流程里刚验证的独立会话（G-LOGIN-13）。
    const src = { sess, active: !!sess && sess === session && userId === uid, gen: acctGen, uid, onSession };
    // 请求返回后、任何本机写入 / 清理之前复核：仍是本页发起的这次登录实例。已登录实例查共享存储的登录所有权（失权 → 丢弃本页会话并作废）；
    // 登录流程查“起点登录状态”未被其他页取代（check = finish 的 checkExpectedSession）。返回 null 表示可以继续，否则原样返回这个结果、不动存储。
    src.guard = () => {
      if (dead()) return staleImport();
      if (src.active) {
        const own = checkSessionOwnership();
        if (own.ok) return null;
        if (own.kind === "lost") { dropLostSession(own.reason); return staleImport(); }
        return { ok: false, kind: "local", message: "无法确认本机登录状态" };
      }
      const e = check ? check() : null;
      return e ? { ...e, retryable: false } : null;
    };
    let r;
    if (record.choice === "cloud") {
      r = await writeKeepCloud(uid, record.guestId, record.guestState, record.fingerprint, src, dead);
    } else {
      const d = getDeviceId(storage);
      if (!d.ok) return { ok: false, kind: "local", message: d.message };
      r = await writeMergeGuest(uid, d.id, record, src, expectedRaw, dead);
    }
    if (dead()) return r.stale ? r : staleImport(); // 退出 / 换账号之后才回来：不再继续（本机写入、清游客、改状态都在这之前被拦下）
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
    const gen = acctGen, dead = () => gen !== acctGen; // 这次登录选择的代次：中途退出 / 换账号后，所有联网结果整体作废，不得复活旧账号或覆盖凭证
    const uid = ctx.session.userId;
    const checkExpectedSession = () => {
      if (!ctx.expectedLogin) return null;
      const cur = captureLoginStart();
      if (!cur.ok) return { ok: false, kind: "local", message: "无法确认本机登录状态，登录没有完成" };
      if (cur.sid !== ctx.expectedLogin.sid || cur.instanceId !== ctx.expectedLogin.instanceId) {
        return { ok: false, kind: "session-changed", message: "其他页面已登录或切换账号，本次登录已取消" };
      }
      return null;
    };
    const preSessionErr = checkExpectedSession();
    if (preSessionErr) return preSessionErr;
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
      result = await runPendingImport(record, ctx.session, { dead, check: checkExpectedSession, onSession: s => { ctx.session = s; } });
      if (dead()) return result.stale ? result : staleImport();
      if (!result.ok) return result;
      doc = result.doc; base = result.rev; transferred = wantedImport === "merge";
    } else if (ctx.copy) {
      // 这台设备以前登录过这个账号：沿用本机副本，随后正常合并。
      doc = ctx.copy.doc; base = ctx.copy.base ?? base;
    } else {
      doc = ctx.remoteDoc ?? emptyDoc();
    }
    const commitSessionErr = checkExpectedSession();
    if (commitSessionErr) return commitSessionErr;
    // 恢复后重新选择：导入途中可能刷新过令牌，收尾写回必须用刷新之后的当前会话，不能把挂起时那份旧令牌写回存储（G-LOGIN-13）。
    if (ctx.resume && isSessionShape(session) && session.userId === uid) ctx.session = session;
    if (!result || !result.saved) {
      const dirty = ctx.copy ? ctx.copy.dirty : cleanDirty;
      if (!saveAccount(storage, uid, { doc, base, dirty }, { now: now(), expectEmpty: !ctx.copy })) return { ok: false, kind: "local", message: "无法保存到本机，登录没有完成" };
    }
    const nextInstanceId = newLoginInstanceId();
    if (!setCurrentAccount(storage, uid)) return { ok: false, kind: "local", message: "无法记录当前账号" };
    bumpAcct(); session = ctx.session; userId = uid; email = session.email || ""; loginInstanceId = nextInstanceId; writeAuth();
    if (result && result.kind === "rate-limit") noteRateLimit(result); // 登录时的游客导入读取 / 写入 / 读回被 429：新会话从一开始就带着这段等待（bumpAcct 之后登记，不会被它清掉）
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
  // 删除失败时尝试写入无凭证的撤销标记；只有读回确认不含会话/令牌才算本机凭证已清理。
  function clearStoredAuthVerified() {
    try { storage.removeItem(AUTH_KEY); } catch {}
    try {
      if (storage.getItem(AUTH_KEY) === null) return true;
      try { storage.setItem(AUTH_KEY, JSON.stringify({ revoked: true, reason: "logout-cleanup-failed" })); } catch {}
      const after = storage.getItem(AUTH_KEY);
      if (after === null) return true;
      const marker = JSON.parse(after);
      return marker?.revoked === true && !marker.session && !marker.accessToken && !marker.refreshToken;
    } catch { return false; }
  }
  // ---- 退出的顺序（DB-3.1）----
  // 云端撤销 refresh token 是不可逆的（Supabase：退出后 refresh token 被撤销，access token 到过期前仍可用）。
  // 所以“可能失败、又能回滚”的本机步骤必须排在云端撤销之前；云端撤销之后只允许做“失败也无害”的事（清掉已失效的凭证）。
  //   普通退出：① 先把没上传的同步掉  ② 本机清理（副本 + 当前账号指针；凭证先不动），失败 → 回滚、不联网，云端会话原封不动
  //            ③ 云端 signOut（scope=local，只结束这台设备的会话，不影响其他设备），失败 → 回滚本机、保持登录
  //            ④ 清本机凭证（读回确认）；失败时云端已撤销、凭证已失效，仍算已退出，只提示残留
  //   强制退出（force）：① 本机清理（含凭证，读回确认），失败 → 回滚、不联网  ② 尽力云端 signOut（scope=local），失败 → 已退出，提示云端会话可能仍有效
  //   forceLocalLogout：只做本机清理，不联网、不撤销云端会话（提示云端会话可能仍有效）
  function snapshotLocal(uid) {
    const L = loadAccount(storage, uid, { now: now() });
    if (!L.ok) return { ok: false };
    let authRaw = null;
    try { authRaw = storage.getItem(AUTH_KEY); } catch {}
    return { ok: true, copy: L.copy ? clone(L.copy) : null, authRaw };
  }
  function rollbackLocal(uid, snap) {
    const copyRestored = !snap.copy || saveAccount(storage, uid, snap.copy, { now: now() });
    const accountRestored = setCurrentAccount(storage, uid);
    let authRestored = true;
    if (typeof snap.authRaw === "string") {
      try {
        if (storage.getItem(AUTH_KEY) !== snap.authRaw) storage.setItem(AUTH_KEY, snap.authRaw);
        authRestored = storage.getItem(AUTH_KEY) === snap.authRaw;
      } catch { authRestored = false; }
    }
    pending = copyStillUnsent(uid) || pending;
    return { copyRestored, accountRestored, authRestored, all: copyRestored && accountRestored && authRestored };
  }
  // 本机清理：副本 + 账号指针；clearAuth 时再清凭证（读回确认）。任何一步失败 → 全部回滚，返回失败结果（调用方不得联网）。
  function cleanLocal(uid, { clearAuth, keepCopy }) {
    const snap = snapshotLocal(uid);
    if (!snap.ok) return { ok: false, result: { ok: false, kind: "local", pending: true, message: "无法确认本机副本状态，暂未退出" } };
    const localOk = keepCopy ? setCurrentAccount(storage, null) : logoutLocal(storage, uid);
    const authOk = localOk && (!clearAuth || clearStoredAuthVerified());
    if (localOk && authOk) return { ok: true, snap };
    const rb = rollbackLocal(uid, snap);
    const why = localOk ? "无法确认本机凭证已清除" : "本机退出未完成";
    const message = rb.all ? `${why}，登录状态和学习副本已恢复；云端会话没有动` : `${why}；请检查本机登录状态和学习副本`;
    setStatus(pending ? "pending" : "error", message);
    return { ok: false, result: { ok: false, kind: "local", pending: true, copyRestored: rb.copyRestored, accountRestored: rb.accountRestored, authRestored: rb.authRestored, cloudUntouched: true, message } };
  }
  // 云端只结束这台设备的会话。只有“明确表示会话已经失效”的响应才算已退出：
  //   sessionState "gone"（session_not_found / user_not_found / session_expired）→ 会话本来就没了，等于已退出；
  //   sessionState "token-invalid"（bad_jwt）→ 只能说明访问令牌坏了，会话还在不在要核实：refresh 被拒 = 已死；
  //     refresh 还活着 = 拿新令牌再 signOut 一次（刷新会轮换 refresh token，新凭证必须写回存储，onSession 通知调用方更新回滚快照）；
  //   通用 403、路由 404、代理错误、5xx、断网等一律算失败，调用方要回滚并保持登录。
  async function revokeCloudSession(sess, { onSession, detached = false, isCurrent = null } = {}) {
    if (!sess || !isSessionShape(sess)) return { ok: true, alreadyInvalid: true };
    const fail = (so) => ({ ok: false, kind: so.kind || "server", message: so.message || "退出云端失败" });
    try {
      let so = await api.signOut(sess, "local");
      if (isCurrent && !isCurrent()) return { ok: false, kind: "stale", superseded: true, message: "" }; // 这次退出已被取代（强制本机退出 / 删除账号 / 又登录了）：后面的刷新、写凭证都不做，免得改到新会话
      if (!so || so.ok !== false) return { ok: true };
      if (so.sessionState === "gone") return { ok: true, alreadyInvalid: true };
      if (so.sessionState !== "token-invalid") return fail(so);
      // detached（强制退出）：本机凭证已经清掉，撤销过程只用局部凭证，不读也不写登录态（不 adopt、不 writeAuth、不动 session / email）。
      const isSameLoginInstance = () => {
        const a = inspectAuth();
        if (a.state !== "ours" || a.session.userId !== sess.userId) return false;
        return loginInstanceId === null ? a.instanceId === null : a.instanceId === loginInstanceId;
      };
      if (!detached) {
        if (!isSameLoginInstance()) return { ok: false, kind: "stale", superseded: true, message: "" };
        adoptStoredSession(); // 别的标签页可能刚轮换过刷新令牌：用最新的核实，别拿旧令牌去撞“已使用”
      }
      const rf = await api.refresh(!detached && isSessionShape(session) ? session : sess);
      if (isCurrent && !isCurrent()) return { ok: false, kind: "stale", superseded: true, message: "" }; // 同上：刷新返回时已被取代，不能把旧账号轮换出来的令牌写进新会话 / 存储
      // 只有明确证明刷新令牌 / 会话已死（sessionState "dead"）才算已退出；通用 403、路由 404、请求格式错误、429、5xx、断网都算失败。
      if (!rf.ok) return rf.sessionState === "dead" ? { ok: true, alreadyInvalid: true } : fail(rf);
      if (!isSessionShape(rf.session) || rf.session.userId !== (detached ? sess.userId : userId)) return { ok: false, kind: "auth", message: "登录账号不一致，暂未退出" };
      const cur = rf.session;
      if (!detached) {
        // 即使处于 selfLogoutCleaning，写回刷新令牌前也必须核对 AUTH_KEY 仍是同一个登录实例，绝不覆盖新登录的凭证
        if (!isSameLoginInstance()) return { ok: false, kind: "stale", superseded: true, message: "" };
        session = cur; email = session.email || email; writeAuth();
      }
      if (onSession) onSession();
      so = await api.signOut(cur, "local");
      if (isCurrent && !isCurrent()) return { ok: false, kind: "stale", superseded: true, message: "" };
      if (!so || so.ok !== false) return { ok: true };
      if (so.sessionState === "gone") return { ok: true, alreadyInvalid: true };
      return fail(so);
    } catch { return { ok: false, kind: "server", message: "退出云端失败" }; }
  }
  function finishLocalLogout() {
    if (userId) {
      cancelLocalRetry();
      try { storage.removeItem(localRetryKey(userId)); } catch { /* 保留失败计数，后续自动同步仍安全停机 */ }
      localRetryUser = null; localWritebackFails = 0; localRetryUnknown = false;
    }
    clearStale();
    bumpAcct(); session = null; userId = null; email = ""; baseline = null; pending = false; waiting = null; lastSyncedAt = null; // 退出后不再显示上一个账号的“最近确认同步”
    setStatus(null);
  }

  // 退出操作的所有权：同一个账号会话同一时间只有一个“退出”在跑。
  //   普通退出重复调用 → 合并成同一个（只撤销一次云端会话，调用方拿到同一个结果）；已有强制退出在跑时，强制 / 普通都合并过去。
  //   强制退出（force / forceLocal）可以取代在途的普通退出（forceLocal 还能取代在途的联网强制退出，它不联网、不等撤销）：取代之后，旧退出的任何迟到结果（撤销成功 / 失败 / 刷新）都不能再动本机和内存——
  //   不撤销新会话、不回滚旧账号、不清新凭证、不改状态，也不会让界面再走一次“已退出”。
  //   只合并“当前会话”的退出（logoutOp.gen === acctGen）：同一个账号重新登录之后代次已变，在途的旧退出只是过期登记，新会话的退出必须独立执行，不能被合并进旧的、再随旧的一起作废。
  //   所有权 = logoutOp 仍是自己 && 会话代次没被别人推进过（登录 / 删除账号 / 强制退出都会推进代次；自己推进后用 ownBump 同步登记）。
  let logoutOp = null;
  const supersededLogout = () => ({ ok: false, kind: "stale", stale: true, superseded: true, retryable: false, message: "" });
  function logout(opts = {}) {
    const dropping = !!(opts.force || opts.forceLocal);
    const local = !!opts.forceLocal; // 强制本机退出不联网：不能为了合并而去等在途强制退出的云端撤销，所以它取代在途的联网退出
    if (userId && logoutOp && logoutOp.uid === userId && logoutOp.gen === acctGen && (!dropping || (logoutOp.dropping && (!local || logoutOp.local)))) return logoutOp.promise; // 合并：同一个会话已有退出在跑
    const op = { uid: userId, dropping, local, gen: acctGen, promise: null };
    if (userId) logoutOp = op;
    const promise = logoutImpl(op, opts);
    op.promise = promise;
    promise.finally(() => { if (logoutOp === op) logoutOp = null; }).catch(() => {});
    return promise;
  }
  async function logoutImpl(op, { force = false, forceLocal = false } = {}) {
    const owns = () => logoutOp === op && acctGen === op.gen;
    const ownBump = () => { bumpAcct(); op.gen = acctGen; }; // 自己前进代次：登记新代次，自己仍然是所有者
    dropVerified(); // 退出（含强制本机退出，forceLocalLogout 走这里）：待读取的已验证会话作废、流程代次前进——没有登录账号时也要做，在途的旧读取返回后会被丢弃
    if (!userId) { bumpAcct(); waiting = null; return { ok: true }; } // 还没登录（正停在“游客记录怎么办”的选择上）：在途的 finishChoice 也要作废，迟到完成不得复活账号
    const preOwn = checkSessionOwnership();
    if (!preOwn.ok && preOwn.kind === "lost") {
      dropLostSession(preOwn.reason);
      return { ok: true, alreadyLoggedOut: true, sessionLost: true, message: "当前账号已在其他页面退出或切换。" };
    }
    const dropping = force || forceLocal;
    const guard = importGuard();
    if (guard) {
      if (!dropping) return guard; // 普通退出不能把损坏待办当成已完成。
      // 用户明确选择本机强制退出：不调用云端、不删账号副本、游客或损坏待办。
      const uid = userId;
      selfLogoutCleaning = true;
      const sessionRemoved = setCurrentAccount(storage, null);
      let sessionGone = false;
      try { sessionGone = storage.getItem(SESSION_KEY) === null; } catch {}
      if (!sessionRemoved || !sessionGone) {
        const rollback = setCurrentAccount(storage, uid);
        let restored = false;
        try { restored = storage.getItem(SESSION_KEY) === uid; } catch {}
        if (owns()) selfLogoutCleaning = false;
        return { ok: false, kind: "local", pending: true, rollbackFailed: !rollback || !restored,
          message: restored ? "账号指针删除失败，退出未完成；本机数据仍保留" : "账号指针清理与恢复均失败，请保留本机数据并人工恢复" };
      }
      // 凭证删除失败后必须验证账号指针是否成功回滚，避免把半退出当作成功。
      // 以读回为准：removeItem 抛错不等于没删掉（先删后报错），只有读回仍有凭证才算失败，否则会出现“凭证已没了却回滚成登录态”的不一致。
      let authCleared = false;
      try { storage.removeItem(AUTH_KEY); } catch {}
      try { authCleared = storage.getItem(AUTH_KEY) === null; } catch {}
      if (!authCleared) {
        const rollback = setCurrentAccount(storage, uid);
        let restored = false;
        try { restored = storage.getItem(SESSION_KEY) === uid; } catch {}
        if (owns()) selfLogoutCleaning = false;
        return { ok: false, kind: "local", pending: true, rollbackFailed: !rollback || !restored,
          message: restored ? "本机凭证清理失败，退出未完成；数据仍保留" : "凭证清理失败且账号指针回滚失败，请保留本机数据并人工恢复" };
      }
      // 与其他本机退出共用同一个收尾（清 stale、重置内存状态、清本机写回重试计数）；只有走到这里才算退出成功，
      // 前面任何一步失败都已回滚并 return，计数和账号副本不会被动。
      finishLocalLogout();
      return { ok: true, cloudSessionMaybeValid: true, warning: "cloud-session-maybe-valid", message: "已在这台设备退出。损坏的游客导入记录和本机进度已保留；云端会话可能仍有效。" };
    }
    if (pending && !dropping) {
      const r = await syncNow();
      if (!owns()) return supersededLogout();
      if (r.sessionLost) return { ok: true, alreadyLoggedOut: true, sessionLost: true, message: "当前账号已在其他页面退出或切换。" };
      if (!r.ok) return { ok: false, pending: true, kind: r.kind, message: r.message };
    }
    const uid = userId;
    if (!dropping && copyStillUnsent(uid)) {
      pending = true;
      setStatus("pending", "还有进度没上传，没有退出");
      return { ok: false, pending: true, kind: "pending", message: "还有进度没上传，没有退出" };
    }
    const sess = session;
    // 没上传的东西还在时，强制退出也保留本机副本；同一个账号再登录会接着上传。
    const keepCopy = dropping && (pending || copyStillUnsent(uid));
    if (dropping) {
      selfLogoutCleaning = true;
      const c = cleanLocal(uid, { clearAuth: true, keepCopy });
      if (!c.ok) { if (owns()) selfLogoutCleaning = false; return c.result; }
      // 本机已经清完：先作废所有在途的旧同步，再去等云端撤销（撤销可能很慢）。否则撤销等待期间，旧同步的迟到刷新会把刚清掉的凭证重新写回。
      ownBump(); session = null; selfLogoutCleaning = true;
      if (forceLocal) { finishLocalLogout(); return { ok: true, cloudSessionMaybeValid: true, warning: "cloud-session-maybe-valid", message: "已在这台设备退出（没有联网）。云端会话可能仍有效。" }; }
      let rv;
      try { rv = await revokeCloudSession(sess, { detached: true, isCurrent: owns }); }
      finally { if (owns()) selfLogoutCleaning = false; }
      if (!owns()) return supersededLogout(); // 撤销等待期间被取代（又强制退出过 / 重新登录了）：不再收尾，不碰新会话
      finishLocalLogout();
      if (!rv.ok) return { ok: true, cloudSessionMaybeValid: true, warning: "cloud-session-maybe-valid", message: "已在这台设备退出。云端会话可能仍有效。" };
      return { ok: true };
    }
    // 普通退出
    if (sess && isSessionShape(sess)) {
      // access token 快过期就先刷新；刷新被拒 = 会话已经失效，不用再撤销；断网等其他失败 → 不退出（没法撤销云端会话）。
      const t = await ensureToken();
      if (!owns()) return supersededLogout();
      if (t.stale) return { ok: true, alreadyLoggedOut: true, sessionLost: true, message: "当前账号已在其他页面退出或切换。" };
      // 刷新失败只有“明确证明会话已死”才继续退出（没东西可撤销）；其他失败（权限错误、路由错误、请求格式错误、429、断网、账号不一致）都先不动本机。
      if (!t.ok && t.sessionState !== "dead") return { ok: false, stayed: true, kind: t.kind || "server", pending: copyStillUnsent(uid), message: t.message || "退出云端失败，暂未退出" };
    }
    selfLogoutCleaning = true;
    const c = cleanLocal(uid, { clearAuth: false, keepCopy: false });
    if (!c.ok) { if (owns()) selfLogoutCleaning = false; return c.result; }
    ownBump(); // 同上：本机清理已成功，等云端撤销之前先作废旧同步；撤销失败时下面照旧回滚，回滚后登录态继续用新的代次
    loggingOut = true; selfLogoutCleaning = true; // 撤销等待期间内存里 session / userId 还在（撤销失败要回滚），新触发的同步一律拒绝
    let rv;
    try { rv = await revokeCloudSession(session, { isCurrent: owns, onSession: () => { try { const a = inspectAuth(); if ((a.state === "ours" || a.state === "other") && a.session.userId === uid && (loginInstanceId === null || a.instanceId === loginInstanceId)) c.snap.authRaw = storage.getItem(AUTH_KEY); } catch { /* 读不到就保留旧快照 */ } } }); }
    finally { if (owns()) { loggingOut = false; selfLogoutCleaning = false; } } // 被取代时标志已由取代者的 bumpAcct 清掉；这里不能把后来新退出设的标志清掉
    if (!owns()) return supersededLogout(); // 旧退出被取代：撤销成功 / 失败都不再回滚、不清凭证、不动状态
    const afterRevokeCur = readCurrentAccount(storage);
    const afterRevokeAuth = inspectAuth();
    const takenOverByOther = (afterRevokeCur.ok && afterRevokeCur.id && afterRevokeCur.id !== uid)
      || ((afterRevokeAuth.state === "ours" || afterRevokeAuth.state === "other")
        && (afterRevokeAuth.session.userId !== uid || (loginInstanceId !== null && afterRevokeAuth.instanceId !== loginInstanceId)));
    if (takenOverByOther) {
      dropLostSession("switched-account");
      return { ok: true, alreadyLoggedOut: true, sessionLost: true, message: "退出过程中其他页面已切换账号，本机新账号未受影响。" };
    }
    if (!rv.ok) {
      selfLogoutCleaning = true;
      let rb;
      try { rb = rollbackLocal(uid, c.snap); } finally { if (owns()) selfLogoutCleaning = false; }
      const message = rb.all ? rv.message : `${rv.message}（本机状态恢复不完整，请检查登录状态和学习副本）`;
      return { ok: false, stayed: true, kind: rv.kind, pending: copyStillUnsent(uid), copyRestored: rb.copyRestored, accountRestored: rb.accountRestored, message };
    }
    // 云端已撤销，本机副本和账号指针已清。最后清凭证：失败也只是残留一份已失效的令牌，不能再回头。
    const expiresAt = isSessionShape(session) ? session.expiresAt : null;
    const leftRt = isSessionShape(session) ? session.refreshToken : null; // finishLocalLogout 之后 session 就是 null 了
    const authCleared = clearStoredAuthVerified();
    finishLocalLogout();
    if (!authCleared) {
      // 云端撤销的是 refresh token（这个会话）；访问令牌（JWT）要到期才失效，所以不能说“已完全失效”。
      leftoverAuth = true; leftoverRt = leftRt;
      const until = Number.isFinite(expiresAt) ? new Date(expiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : null;
      return { ok: true, warning: "local-auth-leftover", authLeftover: true, accessTokenValidUntil: expiresAt,
        message: `已退出，云端已撤销这台设备的登录。但本机残留的登录凭证没清掉：它的刷新令牌已失效，访问令牌${until ? "最晚到 " + until + " 前" : "在到期前"}仍可能有效。请再次清理。` };
    }
    return { ok: true };
  }

  // 云端已撤销、但本机凭证没清掉：没有账号（已退出）时，存储里还有一份真凭证。
  let leftoverAuth = false;
  let leftoverRt = null; // 留下的那份凭证的 refresh token：清理时存储里已不是这一份，说明被别的标签页换过，不能删
  // 本机登录凭证的“三态”读取：读取失败不能折叠成“没有”（旧实现 readAuth 把抛错当成 null，页面重开后读不出凭证就被当成“没有凭证”）。
  //   absent 确定没有；read-failed 读不出来（抛错或返回了非字符串）；inert 有内容但不是可用凭证（撤销标记 / 无法识别）；
  //   other 别的云端项目的凭证（绝不碰）；ours 这个项目的真凭证。
  function inspectAuth() {
    let raw;
    try { raw = storage.getItem(AUTH_KEY); } catch { return { state: "read-failed" }; }
    if (raw === null) return { state: "absent" };
    if (typeof raw !== "string") return { state: "read-failed" };
    let r; try { r = JSON.parse(raw); } catch { return { state: "inert" }; }
    if (!r || !isSessionShape(r.session)) return { state: "inert" };
    if (projectId && (r.project || legacyProject) !== projectId) return { state: "other" };
    const instanceId = typeof r.instanceId === "string" && r.instanceId ? r.instanceId : null;
    return { state: "ours", session: r.session, instanceId, raw };
  }
  // 只删“我们检查过的那一份”残留凭证：删之前、写撤销标记之前都再读一次，存储里已经不是这一份（别的标签页刚登录 / 刚刷新令牌）就立刻停。
  // 返回 { ok:true } | { ok:false, changed:true } | { ok:false }。仍有一个同步语句之间的极小空档（浏览器没有跨标签页的原子比较删除），文档里如实写明。
  function clearLeftoverAuthIf(expectRaw) {
    const cur = () => { try { const v = storage.getItem(AUTH_KEY); return { ok: true, v }; } catch { return { ok: false }; } };
    let c = cur();
    if (!c.ok) return { ok: false };
    if (c.v !== expectRaw) return { ok: false, changed: true };
    try { storage.removeItem(AUTH_KEY); } catch {}
    c = cur();
    if (!c.ok) return { ok: false };
    if (c.v === null) return { ok: true };
    if (c.v !== expectRaw) return { ok: false, changed: true }; // 删除期间被换成了别的内容：那是别人的登录，绝不能再覆盖
    try { storage.setItem(AUTH_KEY, JSON.stringify({ revoked: true, reason: "logout-cleanup-failed" })); } catch {}
    c = cur();
    if (!c.ok) return { ok: false };
    if (c.v === null) return { ok: true };
    try { const m = JSON.parse(c.v); if (m?.revoked === true && !m.session && !m.accessToken && !m.refreshToken) return { ok: true }; } catch {}
    return { ok: false };
  }
  function hasLeftoverAuth() {
    if (userId) return false;
    const p = readCurrentAccount(storage);
    if (!p.ok) return true;  // 账号指针读不出来：无法排除“有残留”，也无法排除“别的标签页在登录”——让用户看到入口，点击时如实说明
    if (p.id) return false;  // 别的标签页已登录同一份存储：那份凭证是在用的，不是残留
    if (leftoverAuth) return true;
    const a = inspectAuth();
    return a.state === "ours" || a.state === "read-failed";
  }
  // 用户可以随时再次清理（不联网）。规则：
  //   ① 只在确认“没有登录”时才动：账号指针读不出来 → 失败（read-failed），指针有账号 → 拒绝（logged-in）；
  //   ② 凭证读不出来 → 失败（read-failed），绝不当成“没有凭证”；
  //   ③ 存储里的已不是当时留下的那份 → 拒绝（changed）；
  //   ④ 清理成功必须读回确认；确认不了就是失败。
  async function retryAuthCleanup() {
    if (userId) return { ok: false, kind: "logged-in", message: "还在登录状态，不能清理登录凭证" };
    const p = readCurrentAccount(storage);
    if (!p.ok) return { ok: false, kind: "read-failed", message: "无法读取本机的登录状态，不能确认别的标签页是否还在登录，所以没有清理。请检查浏览器的存储权限后再试。" };
    if (p.id) return { ok: false, kind: "logged-in", message: "这台设备上已经有账号在登录（可能是另一个标签页），不能清理登录凭证" };
    const a = inspectAuth();
    if (a.state === "read-failed") { leftoverAuth = true; return { ok: false, kind: "read-failed", message: "无法读取本机的登录凭证，无法确认有没有清干净。请检查浏览器的存储权限后再试。" }; }
    if (a.state !== "ours") { leftoverAuth = false; leftoverRt = null; return { ok: true, nothingToClean: true }; }
    if (leftoverRt && a.session.refreshToken !== leftoverRt) return { ok: false, kind: "changed", message: "本机的登录凭证已经不是上次退出时留下的那一份（可能被另一个标签页重新登录），没有清理。" };
    const p2 = readCurrentAccount(storage); // 动手前再确认一次，缩小和别的标签页登录之间的空档
    if (!p2.ok || p2.id) return { ok: false, kind: p2.ok ? "logged-in" : "read-failed", message: "刚刚检测到登录状态变化，没有清理。" };
    const cleared = clearLeftoverAuthIf(a.raw); // 比对后再删：存储里不再是刚检查的那一份就不动
    if (cleared.changed) return { ok: false, kind: "changed", message: "本机的登录凭证刚刚被另一个标签页换过，没有清理。" };
    if (cleared.ok) {
      const after = inspectAuth(); // 读回：必须确认已经没有可用凭证
      if (after.state === "absent" || after.state === "inert") { leftoverAuth = false; leftoverRt = null; return { ok: true }; }
    }
    leftoverAuth = true;
    return { ok: false, kind: "local", message: "本机登录凭证还是没清掉；请检查浏览器的存储权限后再试" };
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

  // 删除账号：请求发出前就绑定“哪个账号、哪一代会话”，每次异步返回后复查；所有权变了（退出 / 强制退出 / 换账号 / 重新登录）就不再清理本机，
  // 只如实报告云端结果（cloudDeleted）。云端删除是不可逆的，所以请求绝不能拿别的会话的令牌发出去：令牌刷新返回后先复查，再发。
  // 同一个会话重复调用合并成同一个（只发一次删除请求）。
  let deleteOp = null;
  // cloudDeleted 三态：true = 云端确认已删除；false = 云端明确报错（没删）；null = 结果未知（请求发出后响应丢了 / 读正文失败 / 超时——服务端可能已经提交了删除）。
  // 未知时绝不能说“没有完成”：删除不可逆，说错会误导用户。
  const DELETE_STALE_MSG = { true: "账号已在云端删除。这台设备在删除过程中已退出或换了账号，本机没有改动。", false: "删除没有完成，云端报错了；这台设备在删除过程中已退出或换了账号，本机没有改动。", null: "无法确认旧账号是否已删除；当前登录和本机数据未改动。" };
  const staleDelete = (cloudDeleted, extra = {}) => ({ ok: false, kind: "stale", stale: true, superseded: true, retryable: false, cloudDeleted, message: DELETE_STALE_MSG[cloudDeleted], ...extra });
  const deleteOutcome = (r) => (r.ok === true ? true : r.kind === "network" ? null : false);
  function deleteAccount() {
    if (!userId) return Promise.resolve({ ok: false, kind: "no-account" });
    if (deleteOp && deleteOp.gen === acctGen && deleteOp.uid === userId && deleteOp.inst === loginInstanceId) return deleteOp.promise; // 合并：同一个登录实例的删除已在进行
    const op = { uid: userId, gen: acctGen, inst: loginInstanceId, promise: null };
    deleteOp = op;
    op.promise = deleteAccountImpl(op);
    op.promise.finally(() => { if (deleteOp === op) deleteOp = null; }).catch(() => {});
    return op.promise;
  }
  async function deleteAccountImpl(op) {
    const gen = op.gen, uid = op.uid, inst = op.inst;
    const verifyDeleteOwnership = () => {
      if (gen !== acctGen || userId !== uid || loginInstanceId !== inst) return { ok: false, lost: true };
      const own = checkSessionOwnership();
      if (own.ok) return { ok: true };
      if (own.kind === "lost") { dropLostSession(own.reason); return { ok: false, lost: true }; }
      return { ok: false, lost: false };
    };
    const v0 = verifyDeleteOwnership();
    if (!v0.ok) {
      if (v0.lost) return { ok: false, kind: "session-lost", sessionLost: true, message: "登录状态已失效或已在其他页面切换，未执行删除" };
      return { ok: false, kind: "local", message: "无法确认本机登录状态，未执行删除" };
    }
    const guard = importGuard();
    if (guard) return guard;
    const t = await ensureToken(gen);
    const v1 = verifyDeleteOwnership();
    if (!v1.ok) return staleDelete(false, { cloudDeleted: false, notSent: true, message: "删除没有发出：这台设备在删除过程中已退出或换了账号。" });
    if (!t.ok) return t;
    const afterTokenGuard = importGuard();
    if (afterTokenGuard) return afterTokenGuard;
    const sess = session; // 绑定发起时这一代会话的凭证：之后无论内存里换成谁，都只用它
    const r = await api.deleteAccount(sess);
    // 请求在途时本机已退出 / 换账号 / 同号重新登录：绝不清理共享存储中的新登录实例数据，仅报告云端三态结果
    const v2 = verifyDeleteOwnership();
    if (!v2.ok) return staleDelete(deleteOutcome(r));
    if (!r.ok) {
      if (r.kind === "network") return { ...r, retryable: false, deleteUncertain: true, cloudDeleted: null, localCleaned: false,
        message: "无法确认云端是否已完成删除，本机记录未清理，请先备份学习进度。" };
      return r;
    }
    let cleaned = false;
    try { cleaned = logoutLocal(storage, uid) && clearPendingImport(storage, uid); } catch { cleaned = false; }
    if (!cleaned) {
      // 云端已经删掉。本机清不干净时：停用旧令牌、留下副本、不宣称完全成功。
      disableStoredToken();
      bumpAcct(); userId = null; email = ""; loginInstanceId = null; baseline = null; pending = false; waiting = null; lastSyncedAt = null;
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
    bumpAcct(); session = null; userId = null; email = ""; loginInstanceId = null; baseline = null; pending = false; waiting = null; lastSyncedAt = null; // 退出后不再显示上一个账号的“最近确认同步”
    writeAuth(); setStatus(null);
    return { ok: true };
  }

  return {
    restore, retryRestore, restoreError, persistLocal, syncNow, scheduleSync, sendCode, verify, retryRead, clearVerified: dropVerified, hasVerified: () => !!verified && now() < verified.expiresAt, finishChoice, logout, forceLocalLogout, hasLeftoverAuth, retryAuthCleanup, pendingRecoveryInfo, quarantinePendingImport, resumeGuestImportChoice, deleteAccount, reconcileSession,
    account: () => (userId ? { userId, email } : null),
    status: () => ({ status, pending, message: lastError, detail: lastDetail, lastStatusAt, lastSyncedAt }),
  };
}
