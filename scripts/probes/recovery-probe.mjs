// 探针：损坏待办锁定之后，用户/代码到底有没有出口。只读真实仓库代码，用假存储和假云端，不联网。
const R = new URL('../../src/', import.meta.url).href;
const { createSync, AUTH_KEY } = await import(R + 'sync.js');
const store = await import(R + 'account-store.js');
const { emptyDoc, guestFingerprint } = await import(R + 'account-data.js');
const { freshState } = await import(R + 'storage.js');
const { GUEST_KEY, DEVICE_KEY, saveAccount, setCurrentAccount, getCurrentAccount, loadPendingImport } = store;
const NOW = 1_000_000, TODAY = '2026-11-05', UID = 'uProbe', PK = `suipian.acct.import.${UID}`;
const sess = () => ({ userId: UID, email: 'p@example.test', accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 3_600_000 });
const mem = () => { const m = new Map(); return { _m: m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
function world(pendingRaw) {
  const raw = mem(); raw.setItem(DEVICE_KEY, 'devP');
  const guest = { ...freshState(), onboarded: true, xp: 90, lessonsCompleted: 6, done: { U1L1: true, U1L2: true }, streak: 1, lastDay: TODAY };
  raw.setItem(GUEST_KEY, JSON.stringify(guest));
  saveAccount(raw, UID, { doc: emptyDoc({ gen: 1, lineage: 'L-p' }), base: 3, dirty: { content: true, hearts: false, prefs: false } }, { now: NOW });
  setCurrentAccount(raw, UID); raw.setItem(AUTH_KEY, JSON.stringify({ session: sess() }));
  raw.setItem(PK, pendingRaw);
  const calls = [];
  const api = { calls, async verifyCode() { calls.push('verifyCode'); return { ok: true, session: sess() }; },
    async getProgress() { calls.push('getProgress'); return { ok: true, row: { doc: emptyDoc({ gen: 1, lineage: 'L-p' }), rev: 3 } }; },
    async saveProgress() { calls.push('saveProgress'); return { ok: true, rev: 4 }; }, async createProgress() { calls.push('createProgress'); return { ok: true, rev: 1 }; },
    async refresh() { calls.push('refresh'); return { ok: true, session: sess() }; }, async signOut() { calls.push('signOut'); return { ok: true }; },
    async deleteAccount() { calls.push('deleteAccount'); return { ok: true }; } };
  const mk = () => createSync({ storage: raw, api, now: () => NOW, today: () => TODAY, schedule: () => 1 });
  return { raw, api, mk, guest };
}
const out = (k, v) => console.log(k.padEnd(46), JSON.stringify(v));
const w = world('{bad json'); const s = w.mk(); s.restore(freshState());
out('公开 API 里有没有恢复/修复入口', Object.keys(s).filter(k => /recover|repair|reset|discard|quarant|abandon|skip/i.test(k)));
out('S1 syncNow（锁定）', { kind: (await s.syncNow()).kind, cloudCalls: w.api.calls });
out('S1 status', s.status().status);
const d = await s.deleteAccount(); out('S2 deleteAccount（锁定）', { ok: d.ok, kind: d.kind, cloudCalls: w.api.calls.filter(c => c === 'deleteAccount') });
// S3：本机退出后用同一账号重新登录
const f = await s.forceLocalLogout(); out('S3a forceLocalLogout', { ok: f.ok });
const s2 = w.mk(); s2.restore(freshState());
const v = await s2.verify('p@example.test', '123456', freshState());
out('S3b 同账号重新登录 verify', { ok: v.ok, needChoice: v.needChoice, kind: v.kind, message: v.message });
out('S3c 登录后 status', s2.status().status);
out('S3d 登录后待办原文是否还在', w.raw.getItem(PK));
const ps = await s2.syncNow(); out('S3e 登录后 syncNow', { ok: ps.ok, kind: ps.kind });
// S4：用户重新选择导入（游客记录有学习）
const w4 = world('{bad json'); const a = w4.mk(); a.restore(freshState()); await a.forceLocalLogout();
// 模拟全新设备状态：账号副本被清掉才会出现选择弹窗
w4.raw.removeItem(`suipian.acct.${UID}`);
const b = w4.mk(); b.restore(freshState());
const vb = await b.verify('p@example.test', '123456', freshState());
out('S4a 无副本+有游客+损坏待办 → verify', { ok: vb.ok, needChoice: vb.needChoice, kind: vb.kind });
if (vb.needChoice) { const c = await b.finishChoice('merge'); out('S4b 选"合并" finishChoice', { ok: c.ok, kind: c.kind, message: c.message }); }
out('S4c 游客记录是否仍在', w4.raw.getItem(GUEST_KEY) !== null);
// S5：读取失败（存储抛错）与损坏的区别：恢复动作需要先区分
const w5 = world('whatever'); const pk = loadPendingImport(w5.raw, UID); out('S5 损坏的 loadPendingImport', pk);
