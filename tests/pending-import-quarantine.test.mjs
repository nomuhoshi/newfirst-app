// 损坏导入待办的恢复：quarantinePendingImport() / pendingRecoveryInfo() / resumeGuestImportChoice()
// 纯 Node + 假存储 + 假云端，不联网、不接任何 Supabase 项目。运行：node --test tests/pending-import-quarantine.test.mjs
// 要点：只处理“确认损坏”；备份读回一致后才删原待办；账号 / 待办被别的标签页换掉立刻停；游客记录、账号副本、凭证逐字节不动；
//       隔离本身零网络；隔离后重新选择不丢数据、不重复加分；任何失败都保留原文且不宣称恢复成功；固定指纹样本防算法漂移。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, AUTH_KEY, scopedStorage, projectNamespace } from '../src/sync.js';
import { GUEST_KEY, GUEST_ID_KEY, DEVICE_KEY, SESSION_KEY, getGuestId, loadPendingImport, parsePendingImport, rawDigest, quarantineKey,
  readQuarantineBackup, saveAccount, setCurrentAccount } from '../src/account-store.js';
import { emptyDoc, guestFingerprint, sumXp } from '../src/account-data.js';
import { freshState } from '../src/storage.js';

const NOW = 1_000_000, TODAY = '2026-11-05', UID = 'uQuar', MAIL = 'quar@example.test';
const PENDING_KEY = `suipian.acct.import.${UID}`, ACCT_KEY = `suipian.acct.${UID}`;
const clone = (x) => JSON.parse(JSON.stringify(x));
const session = () => ({ userId: UID, email: MAIL, accessToken: 'fake-at', refreshToken: 'fake-rt', expiresAt: NOW + 3_600_000 });
const BAD = '{bad json';

function mem() {
  const m = new Map();
  const o = { _m: m, hooks: {}, flags: {}, removed: [],
    getItem(k) { o.hooks.get?.(k, o); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { const h = o.hooks.set?.(k, v, o); if (h === 'throw') throw new Error('quota'); m.set(k, h && typeof h === 'object' ? h.store : String(v)); if (k.includes('suipian.acct.quarantine.')) o.flags.backedUp = true; },
    removeItem(k) { o.removed.push(k); const h = o.hooks.remove?.(k, o); if (h === 'silent') return; if (h === 'throw') throw new Error('denied'); m.delete(k); if (h === 'throw-after') throw new Error('denied after delete'); } };
  return o;
}
const guestOf = (xp = 80) => ({ ...freshState(), heartsAt: NOW, onboarded: true, xp, lessonsCompleted: 5, done: { U1L1: true, U1L2: true }, streak: 1, lastDay: TODAY });
function cloudDoc(gid, kind) {
  const d = emptyDoc({ gen: 1, lineage: 'L-quar' });
  d.xp.devCloud = 50; d.runs.devCloud = 3; d.done = { U1L1: '2026-11-03' }; d.days = ['2026-11-03'];
  if (kind === 'imported') d.imported[gid] = guestFingerprint(guestOf(80));      // 云端已经导入过当前这份游客记录
  if (kind === 'imported-older') d.imported[gid] = guestFingerprint(guestOf(10)); // 导入的是更早的游客进度，之后游客又学了
  return d;
}
function makeApi(initial, { failUpload = false } = {}) {
  const calls = [], state = { row: { doc: clone(initial), rev: 7 } };
  return { calls, state,
    async verifyCode() { calls.push('verifyCode'); return { ok: true, session: session() }; },
    async refresh() { calls.push('refresh'); return { ok: true, session: session() }; },
    async getProgress() { calls.push('getProgress'); return { ok: true, row: clone(state.row) }; },
    async saveProgress(_s, expected, doc) { calls.push('saveProgress'); if (failUpload) return { ok: false, kind: 'network', message: '写入失败（注入）' }; if (expected !== state.row.rev) return { ok: true, rev: null }; state.row = { doc: clone(doc), rev: state.row.rev + 1 }; return { ok: true, rev: state.row.rev }; },
    async createProgress(_s, doc) { calls.push('createProgress'); state.row = { doc: clone(doc), rev: 1 }; return { ok: true, rev: 1 }; },
    async signOut() { calls.push('signOut'); return { ok: true }; } };
}
// pendingRaw: 字符串 = 写入该原文；null = 不放待办（对照组）。cloud: 'new' | 'imported' | 'imported-older'
function fixture({ pendingRaw = BAD, cloud = 'new', guestXp = 80, projectId = null, failUpload = false } = {}) {
  const raw = mem(); raw.setItem(DEVICE_KEY, 'devQuar');
  const ns = projectNamespace(projectId, 'legacyhost');
  const st = ns ? scopedStorage(raw, ns) : raw;
  const guest = guestOf(guestXp), guestRaw = JSON.stringify(guest);
  raw.setItem(GUEST_KEY, guestRaw); raw.setItem(GUEST_ID_KEY, 'gQuarFixed'); // 固定游客编号：对照组与恢复组的云端文档才能逐字比较
  const gid = getGuestId(raw).id;
  const cdoc = cloudDoc(gid, cloud);
  const local = clone(cdoc); local.xp.devCloud = 50;
  assert.equal(saveAccount(st, UID, { doc: local, base: 7, dirty: { content: false, hearts: false, prefs: false } }, { now: NOW }), true);
  assert.equal(setCurrentAccount(st, UID), true);
  st.setItem(AUTH_KEY, JSON.stringify(projectId ? { session: session(), project: projectId } : { session: session() }));
  if (pendingRaw !== null) st.setItem(PENDING_KEY, pendingRaw);
  raw.flags = {}; raw.removed.length = 0;
  const api = makeApi(cdoc, { failUpload });
  const sync = createSync({ storage: raw, api, projectId, legacyProject: projectId ? 'legacyhost' : null, now: () => NOW, today: () => TODAY, schedule: () => 1 });
  assert.ok(sync.restore(freshState()));
  return { raw, st, ns, guest, guestRaw, gid, cdoc, api, sync };
}
const snap = (f) => ({ guest: f.st.getItem(GUEST_KEY), acct: f.st.getItem(ACCT_KEY), auth: f.st.getItem(AUTH_KEY), ptr: f.st.getItem(SESSION_KEY), device: f.st.getItem(DEVICE_KEY) });
const backupKeys = (f) => [...f.raw._m.keys()].filter((k) => k.includes('suipian.acct.quarantine.'));
const validPendingFor = (f) => ({ version: 1, userId: UID, guestId: f.gid, choice: 'merge', fingerprint: guestFingerprint(f.guest), guestRaw: f.guestRaw, guestState: clone(f.guest), createdAt: NOW });

// ---- Q0 固定指纹黄金样本：算法一变，R1 的“指纹必须匹配”校验会把升级时仍存在的旧待办判成损坏并永久锁死，所以必须有一个红灯 ----
test('Q0: 固定游客样本 → 固定指纹；用这个指纹写成的待办原文固定解析为完好（算法漂移会红）', () => {
  const GOLDEN = { version: 3, onboarded: true, xp: 120, lessonsCompleted: 4, done: { U1L3: true, U1L1: true, U1L2: true, U2L1: true, U1L9: false }, streak: 3, lastDay: '2026-11-04', hearts: 4, prefs: { sound: 'J' } };
  assert.equal(guestFingerprint(GOLDEN), 'e1962bd5', '指纹算法变了：旧版本留下的导入待办升级后会被判损坏。若是有意修改，必须同时提供迁移方案并更新本黄金值');
  // 同样的学习内容，key 顺序 / 红心 / 设置不同，指纹不变；学习内容变了指纹必变
  assert.equal(guestFingerprint({ ...GOLDEN, hearts: 1, prefs: {} }), 'e1962bd5');
  assert.notEqual(guestFingerprint({ ...GOLDEN, xp: 121 }), 'e1962bd5');
  const guestRaw = JSON.stringify(GOLDEN);
  const record = { version: 1, userId: UID, guestId: 'gGolden', choice: 'merge', fingerprint: 'e1962bd5', guestRaw, guestState: GOLDEN, createdAt: 1 };
  assert.equal(parsePendingImport(JSON.stringify(record), UID).ok, true, '固定样本待办必须解析为完好');
  assert.equal(parsePendingImport(JSON.stringify({ ...record, fingerprint: 'e1962bd4' }), UID).code, 'corrupt');
  // 摘要也固定：备份键靠它命名
  assert.equal(rawDigest(BAD), '9-6abfc5355e48142a');
});

// ---- 判断：只有“确认损坏”才能隔离 ----
test('Q1: pendingRecoveryInfo 区分 corrupt / read-failed / healthy / none；读取失败不给摘要', () => {
  const f = fixture();
  assert.deepEqual(f.sync.pendingRecoveryInfo(), { state: 'corrupt', digest: rawDigest(BAD), bytes: BAD.length });
  f.st.setItem(PENDING_KEY, JSON.stringify(validPendingFor(f)));
  assert.equal(f.sync.pendingRecoveryInfo().state, 'healthy');
  f.raw._m.delete(PENDING_KEY);
  assert.equal(f.sync.pendingRecoveryInfo().state, 'none');
  f.st.setItem(PENDING_KEY, BAD);
  f.raw.hooks.get = (k) => { if (k === PENDING_KEY) throw new Error('storage read failure'); };
  assert.equal(f.sync.pendingRecoveryInfo().state, 'read-failed');
});

test('Q2: 读取失败（抛错 / 静默 undefined）只能重试：不隔离、不写备份、原文不动', async () => {
  for (const mode of ['throw', 'undefined']) {
    const f = fixture(); const before = snap(f);
    f.raw.hooks.get = (k, o) => { if (k === PENDING_KEY && o.flags.broken !== false) { if (mode === 'throw') throw new Error('storage read failure'); } };
    if (mode === 'undefined') { const orig = f.raw.getItem.bind(f.raw); f.raw.getItem = (k) => (k === PENDING_KEY ? undefined : orig(k)); }
    const r = await f.sync.quarantinePendingImport();
    assert.equal(r.ok, false, mode); assert.equal(r.kind, 'read-failed', mode); assert.equal(r.originalKept, true); assert.equal(r.quarantined, false);
    assert.equal(backupKeys(f).length, 0, '读取失败绝不写备份');
    assert.equal(f.raw._m.get(PENDING_KEY), BAD); assert.deepEqual(f.raw.removed, []);
    assert.deepEqual(snap(f), before); assert.deepEqual(f.api.calls, []);
  }
});

test('Q3: 完好的待办 / 没有待办 / 没登录：一律拒绝，什么都不动', async () => {
  const f = fixture(); f.st.setItem(PENDING_KEY, JSON.stringify(validPendingFor(f)));
  const healthy = f.raw._m.get(PENDING_KEY);
  assert.equal((await f.sync.quarantinePendingImport()).kind, 'not-corrupt');
  assert.equal(f.raw._m.get(PENDING_KEY), healthy);
  const g = fixture({ pendingRaw: null });
  assert.equal((await g.sync.quarantinePendingImport()).kind, 'no-pending');
  const h = createSync({ storage: mem(), api: makeApi(emptyDoc()), now: () => NOW, today: () => TODAY, schedule: () => 1 });
  assert.equal((await h.quarantinePendingImport()).kind, 'no-account');
  assert.equal(backupKeys(f).length + backupKeys(g).length, 0);
});

// ---- 主路径 ----
test('Q4: 确认损坏：备份原文（读回一致）→ 才删原待办；游客 / 账号副本 / 凭证 / 指针逐字节不动；零网络', async () => {
  const f = fixture(); const before = snap(f);
  const info = f.sync.pendingRecoveryInfo();
  const r = await f.sync.quarantinePendingImport({ expectedDigest: info.digest });
  assert.equal(r.ok, true); assert.equal(r.quarantined, true); assert.equal(r.originalKept, false); assert.equal(r.digest, info.digest);
  const bk = readQuarantineBackup(f.st, UID, info.digest);
  assert.ok(bk, '备份存在'); assert.equal(bk.raw, BAD, '备份是逐字原文'); assert.equal(bk.userId, UID); assert.equal(bk.kind, 'pending-import');
  assert.equal(f.raw._m.has(PENDING_KEY), false, '原待办已移除');
  assert.deepEqual(snap(f), before, '游客 / 账号副本 / 凭证 / 指针 / 设备编号逐字节不变');
  assert.deepEqual(f.api.calls, [], '隔离本身零网络请求');
  assert.deepEqual(f.raw.removed, [PENDING_KEY], '只删了待办这一个键');
  assert.equal(loadPendingImport(f.st, UID).ok, true, '硬锁解除');
  assert.equal(f.sync.pendingRecoveryInfo().state, 'none');
});

test('Q5: 先备份后删除的顺序：删除发生时备份已经在存储里且内容一致', async () => {
  const f = fixture(); let backupSeenAtRemove = null;
  f.raw.hooks.remove = (k, o) => { if (k === PENDING_KEY) backupSeenAtRemove = [...o._m.entries()].find(([kk]) => kk.includes('suipian.acct.quarantine.')); };
  assert.equal((await f.sync.quarantinePendingImport()).ok, true);
  assert.ok(backupSeenAtRemove, '删除原待办时备份必须已在存储里');
  assert.equal(JSON.parse(backupSeenAtRemove[1]).raw, BAD);
});

test('Q6: 备份写不进去 / 读回不一致：原文保留，不删，不宣称成功', async () => {
  for (const [name, hook] of [['写入抛错', () => 'throw'], ['读回被改写', (_k, v) => ({ store: v.slice(0, -5) })]]) {
    const f = fixture(); const before = snap(f);
    f.raw.hooks.set = (k, v) => (k.includes('suipian.acct.quarantine.') ? hook(k, v) : undefined);
    const r = await f.sync.quarantinePendingImport();
    assert.equal(r.ok, false, name); assert.equal(r.kind, 'backup-failed', name); assert.equal(r.quarantined, false); assert.equal(r.originalKept, true);
    assert.doesNotMatch(r.message, /已备份并|已恢复|恢复成功/, '失败文案不能说成功');
    assert.equal(f.raw._m.get(PENDING_KEY), BAD, name); assert.deepEqual(f.raw.removed, [], name + '：绝不能删原待办');
    assert.deepEqual(snap(f), before);
    assert.equal(loadPendingImport(f.st, UID).code, 'corrupt', '仍然锁着');
  }
});

test('Q7: 备份键里已有别的内容：拒绝覆盖，原文保留', async () => {
  const f = fixture(); const key = quarantineKey(UID, rawDigest(BAD));
  f.st.setItem(key, JSON.stringify({ version: 1, kind: 'pending-import', userId: UID, digest: rawDigest(BAD), raw: 'something else' }));
  const r = await f.sync.quarantinePendingImport();
  assert.equal(r.ok, false); assert.equal(r.kind, 'backup-failed'); assert.match(r.message, /backup-conflict/);
  assert.equal(f.raw._m.get(PENDING_KEY), BAD); assert.deepEqual(f.raw.removed, []);
  assert.equal(JSON.parse(f.raw._m.get(key)).raw, 'something else', '别人的备份没被覆盖');
});

test('Q8: 原待办删不掉（静默无效）：保留原文和备份、报 remove-failed；故障排除后重试成功并复用备份', async () => {
  const f = fixture();
  f.raw.hooks.remove = (k) => (k === PENDING_KEY ? 'silent' : undefined);
  const r = await f.sync.quarantinePendingImport();
  assert.equal(r.ok, false); assert.equal(r.kind, 'remove-failed'); assert.equal(r.originalKept, true); assert.equal(r.backedUp, true);
  assert.doesNotMatch(r.message, /已备份并移除|已恢复|恢复成功/);
  assert.equal(f.raw._m.get(PENDING_KEY), BAD); assert.equal(backupKeys(f).length, 1);
  assert.equal(f.sync.pendingRecoveryInfo().state, 'corrupt', '仍然锁着');
  f.raw.hooks.remove = null;
  const r2 = await f.sync.quarantinePendingImport();
  assert.equal(r2.ok, true); assert.equal(r2.reusedBackup, true); assert.equal(backupKeys(f).length, 1, '没有重复备份');
  assert.equal(f.raw._m.has(PENDING_KEY), false);
});

test('Q9: removeItem 先删后抛错：以读回为准，算成功（不会把已经删掉的当失败）', async () => {
  const f = fixture(); f.raw.hooks.remove = (k) => (k === PENDING_KEY ? 'throw-after' : undefined);
  const r = await f.sync.quarantinePendingImport();
  assert.equal(r.ok, true); assert.equal(f.raw._m.has(PENDING_KEY), false); assert.equal(readQuarantineBackup(f.st, UID, rawDigest(BAD)).raw, BAD);
});

// ---- 其他标签页替换 ----
test('Q10: 备份之后、删除之前，别的标签页换了新的待办：立刻停，不删新待办', async () => {
  const f = fixture(); const fresh = JSON.stringify(validPendingFor(f)); const before = snap(f);
  f.raw.hooks.get = (k, o) => { if (k === PENDING_KEY && o.flags.backedUp && !o.flags.swapped) { o.flags.swapped = true; o._m.set(PENDING_KEY, fresh); } };
  const r = await f.sync.quarantinePendingImport();
  assert.equal(r.ok, false); assert.equal(r.kind, 'pending-changed'); assert.equal(r.originalKept, true);
  assert.equal(f.raw._m.get(PENDING_KEY), fresh, '新待办原样'); assert.deepEqual(f.raw.removed, [], '一次删除都没发生');
  assert.deepEqual(snap(f), before); assert.deepEqual(f.api.calls, []);
});

test('Q11: 备份之后账号指针被别的标签页换成另一个账号：立刻停，待办不动', async () => {
  const f = fixture(); const before = snap(f);
  f.raw.hooks.get = (k, o) => { if (k === SESSION_KEY && o.flags.backedUp) o._m.set(SESSION_KEY, 'uOther'); };
  const r = await f.sync.quarantinePendingImport();
  assert.equal(r.ok, false); assert.equal(r.kind, 'account-changed'); assert.equal(f.raw._m.get(PENDING_KEY), BAD); assert.deepEqual(f.raw.removed, []);
  assert.equal(f.raw._m.get(ACCT_KEY), before.acct, '账号副本不动'); assert.equal(f.raw._m.get(GUEST_KEY), before.guest);
});

test('Q12: 开始前账号指针已被换掉 / 用户确认后待办又变了（摘要不符）：拒绝，什么都不写', async () => {
  const a = fixture(); a.raw._m.set(SESSION_KEY, 'uOther');
  assert.equal((await a.sync.quarantinePendingImport()).kind, 'account-changed'); assert.equal(backupKeys(a).length, 0);
  const b = fixture(); const info = b.sync.pendingRecoveryInfo();
  b.raw._m.set(PENDING_KEY, '{another bad one');
  const r = await b.sync.quarantinePendingImport({ expectedDigest: info.digest });
  assert.equal(r.kind, 'pending-changed'); assert.equal(backupKeys(b).length, 0); assert.equal(b.raw._m.get(PENDING_KEY), '{another bad one');
});

test('Q13: 两份不同的损坏原文各自留备份，不覆盖；同一份重复隔离不产生第二个备份', async () => {
  const f = fixture();
  assert.equal((await f.sync.quarantinePendingImport()).ok, true);
  assert.equal((await f.sync.quarantinePendingImport()).kind, 'no-pending');
  f.st.setItem(PENDING_KEY, '{second corruption');
  assert.equal((await f.sync.quarantinePendingImport()).ok, true);
  assert.deepEqual(backupKeys(f).map((k) => JSON.parse(f.raw._m.get(k)).raw).sort(), [BAD, '{second corruption'].sort());
  f.st.setItem(PENDING_KEY, BAD);
  const r = await f.sync.quarantinePendingImport();
  assert.equal(r.ok, true); assert.equal(r.reusedBackup, true); assert.equal(backupKeys(f).length, 2);
});

test('Q14: 备份键带云项目命名空间和账号（测试云项目 proj:<id>: 前缀；正式命名空间里没有）', async () => {
  const f = fixture({ projectId: 'ptest' });
  assert.equal(f.ns, 'proj:ptest:');
  assert.equal((await f.sync.quarantinePendingImport()).ok, true);
  const keys = backupKeys(f);
  assert.equal(keys.length, 1);
  assert.equal(keys[0], `proj:ptest:suipian.acct.quarantine.${UID}.${rawDigest(BAD)}`);
  assert.equal([...f.raw._m.keys()].some((k) => k.startsWith('suipian.acct.quarantine.')), false, '没有写进无前缀（正式）命名空间');
  // 另一个云项目的 sync 看不到这份备份，也看不到这份待办
  const other = createSync({ storage: f.raw, api: f.api, projectId: 'pother', legacyProject: 'legacyhost', now: () => NOW, today: () => TODAY, schedule: () => 1 });
  assert.equal(other.pendingRecoveryInfo().state, 'none');
});

// ---- 隔离之后重新选择 + 云端核对：不丢数据、不重复加分，与“从没损坏过”的对照组结果一致 ----
async function viaRecovery(opts, choice) {
  const f = fixture(opts); const callsBefore = f.api.calls.length;
  const q = await f.sync.quarantinePendingImport({ expectedDigest: f.sync.pendingRecoveryInfo().digest });
  assert.equal(q.ok, true); assert.equal(f.api.calls.length, callsBefore, '隔离零网络');
  const r = await f.sync.resumeGuestImportChoice(freshState());
  return { f, r, choice };
}
async function viaControl(opts) {
  const f = fixture({ ...opts, pendingRaw: null });
  const r = await f.sync.resumeGuestImportChoice(freshState());
  return { f, r };
}
async function settleAndCompare(opts, choice) {
  const rec = await viaRecovery(opts), ctl = await viaControl(opts);
  assert.equal(!!rec.r.needChoice, !!ctl.r.needChoice, '隔离后的流程与没损坏时一致');
  assert.equal(!!rec.r.alreadyImported, !!ctl.r.alreadyImported);
  for (const x of [rec, ctl]) if (x.r.needChoice) { const fr = await x.f.sync.finishChoice(choice); assert.equal(fr.ok, true, JSON.stringify(fr)); }
  for (const x of [rec, ctl]) { await x.f.sync.syncNow({ manual: true }); await x.f.sync.syncNow({ manual: true }); } // 连续同步两次不变
  assert.deepEqual(rec.f.api.state.row.doc, ctl.f.api.state.row.doc, '云端文档与对照组完全一致（没重复加分、没丢数据）');
  assert.equal(sumXp(rec.f.api.state.row.doc), sumXp(ctl.f.api.state.row.doc));
  assert.equal(rec.f.raw._m.get(GUEST_KEY) ?? null, ctl.f.raw._m.get(GUEST_KEY) ?? null, '游客记录的去留与对照组一致');
  assert.equal(rec.f.raw._m.get(ACCT_KEY), ctl.f.raw._m.get(ACCT_KEY), '账号副本与对照组一致');
  assert.equal(rec.f.raw._m.has(PENDING_KEY), false, '没有残留待办');
  return { rec, ctl };
}

test('Q15: 有账号副本 + 云端还没导入过：重新弹出选择；选“合并”后 XP 只加一次，连续同步不变', async () => {
  const { rec } = await settleAndCompare({ cloud: 'new' }, 'transfer');
  const before = sumXp(cloudDoc(rec.f.gid, 'new'));
  assert.ok(sumXp(rec.f.api.state.row.doc) > before, '游客进度确实合进去了');
  assert.ok(sumXp(rec.f.api.state.row.doc) <= before + 80, '没有多加');
  assert.equal(rec.f.raw._m.has(GUEST_KEY), false, '读回一致后才清游客（合并成功）');
});

test('Q16: 同上，选“保留云端”：只写游客指纹，XP 不变，游客记录原样保留', async () => {
  const { rec } = await settleAndCompare({ cloud: 'new' }, 'cloud');
  assert.equal(sumXp(rec.f.api.state.row.doc), sumXp(cloudDoc(rec.f.gid, 'new')));
  assert.equal(rec.f.raw._m.get(GUEST_KEY), rec.f.guestRaw);
  assert.equal(rec.f.api.state.row.doc.imported[rec.f.gid], guestFingerprint(rec.f.guest));
});

test('Q17: 云端其实已经导入过这份游客进度：不再弹选择，XP 不变（不会 +80 重复），游客记录保留', async () => {
  const rec = await viaRecovery({ cloud: 'imported' });
  assert.equal(rec.r.ok, true); assert.equal(rec.r.noChoiceNeeded, true); assert.equal(rec.r.alreadyImported, true);
  const row = clone(rec.f.api.state.row.doc);
  assert.equal(sumXp(row), sumXp(cloudDoc(rec.f.gid, 'imported')), 'XP 不变');
  await rec.f.sync.syncNow({ manual: true });
  assert.deepEqual(rec.f.api.state.row.doc, row, '再同步一次也不变');
  assert.equal(rec.f.raw._m.get(GUEST_KEY), rec.f.guestRaw);
  await settleAndCompare({ cloud: 'imported' }, 'transfer');
});

test('Q18: 游客在隔离之前导入过一次、之后又学了新内容（指纹变了）：重新弹选择，合并后结果与对照组一致且不重复加分', async () => {
  const { rec } = await settleAndCompare({ cloud: 'imported-older' }, 'transfer');
  assert.ok(sumXp(rec.f.api.state.row.doc) <= sumXp(cloudDoc(rec.f.gid, 'new')) + 80);
});

test('Q19: 隔离后写云失败：游客记录和账号副本保留，新待办是完好的（下次自动重试），不宣称成功', async () => {
  const f = fixture({ failUpload: true });
  assert.equal((await f.sync.quarantinePendingImport()).ok, true);
  const r = await f.sync.resumeGuestImportChoice(freshState());
  assert.equal(r.needChoice, true);
  const fr = await f.sync.finishChoice('transfer');
  assert.equal(fr.ok && fr.synced, false, '写云失败不能说已同步');
  assert.equal(f.raw._m.get(GUEST_KEY), f.guestRaw, '游客记录原样');
  assert.equal(loadPendingImport(f.st, UID).ok, true, '新待办是完好的，不会再次锁死');
  assert.ok(f.raw._m.get(ACCT_KEY));
  assert.equal(readQuarantineBackup(f.st, UID, rawDigest(BAD)).raw, BAD, '备份仍在');
});

test('Q20: 隔离后的重新选择在令牌已轮换时使用当前会话（不把挂起时的旧令牌写回存储）', async () => {
  const f = fixture();
  assert.equal((await f.sync.quarantinePendingImport()).ok, true);
  const r = await f.sync.resumeGuestImportChoice(freshState()); assert.equal(r.needChoice, true);
  // 弹窗期间别的流程轮换了令牌：直接把存储里的凭证换成新令牌，再让 sync 重新读（模拟 adoptStoredSession 之后的当前会话）
  const rotated = { ...session(), accessToken: 'fake-at-2', refreshToken: 'fake-rt-2' };
  f.api.refresh = async () => { f.api.calls.push('refresh'); return { ok: true, session: rotated }; };
  const fr = await f.sync.finishChoice('cloud');
  assert.equal(fr.ok, true);
  const auth = JSON.parse(f.raw._m.get(AUTH_KEY));
  assert.ok(['fake-rt', 'fake-rt-2'].includes(auth.session.refreshToken));
  assert.equal(auth.session.userId, UID);
});
