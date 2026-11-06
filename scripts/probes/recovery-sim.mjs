// 模拟「隔离损坏待办后重新走导入」是否安全：只用真实 sync/account-data，假存储+假云端（带 CAS 和调用记录）。
const R = new URL('../../src/', import.meta.url).href;
const { createSync, AUTH_KEY } = await import(R + 'sync.js');
const store = await import(R + 'account-store.js');
const data = await import(R + 'account-data.js');
const { freshState } = await import(R + 'storage.js');
const { GUEST_KEY, DEVICE_KEY, getGuestId } = store;
const NOW = 1_000_000, TODAY = '2026-11-05', UID = 'uSim', PK = `suipian.acct.import.${UID}`;
const sess = () => ({ userId: UID, email: 's@example.test', accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 3_600_000 });
const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const clone = x => JSON.parse(JSON.stringify(x));
async function run(label, cloudHasImport) {
  const raw = mem(); raw.setItem(DEVICE_KEY, 'devSim');
  const guest = { ...freshState(), onboarded: true, xp: 90, lessonsCompleted: 6, done: { U1L1: true, U1L2: true }, streak: 1, lastDay: TODAY };
  raw.setItem(GUEST_KEY, JSON.stringify(guest));
  const gid = getGuestId(raw).id;
  let cloud = data.emptyDoc({ gen: 1, lineage: 'L-sim' }); cloud.xp.devOther = 50; cloud.done = { U1L1: '2026-11-04' }; cloud.days = ['2026-11-04'];
  if (cloudHasImport) { cloud = data.mergeGuestProgress(guest, { deviceId: 'devSim', guestId: gid, cloudDoc: cloud, now: NOW }).doc ?? cloud; const m = data.markGuestImported(cloud, gid, guest); cloud = m.doc ?? cloud; }
  const st = { doc: clone(cloud), rev: 5, saves: 0 }; const calls = [];
  const api = { async verifyCode() { return { ok: true, session: sess() }; }, async getProgress() { calls.push('get'); return { ok: true, row: { doc: clone(st.doc), rev: st.rev } }; },
    async saveProgress(_s, exp, doc) { calls.push('save'); if (exp !== st.rev) return { ok: true, rev: null }; st.doc = clone(doc); st.rev++; st.saves++; return { ok: true, rev: st.rev }; },
    async createProgress(_s, doc) { st.doc = clone(doc); st.rev = 1; return { ok: true, rev: 1 }; }, async refresh() { return { ok: true, session: sess() }; }, async signOut() { return { ok: true }; } };
  // 损坏待办存在 → 模拟「恢复」= 隔离备份后清掉待办（这里直接 removeItem 代替未来的恢复 API）
  raw.setItem(PK, '{bad json'); const quarantine = raw.getItem(PK); raw.removeItem(PK);
  const sync = createSync({ storage: raw, api, now: () => NOW, today: () => TODAY, schedule: () => 1 });
  sync.restore(freshState());
  const v = await sync.verify('s@example.test', '123456', freshState());
  let c = null;
  if (v.needChoice) c = await sync.finishChoice('merge');
  const s1 = await sync.syncNow(); const s2 = await sync.syncNow();
  const xp = data.sumXp(st.doc);
  console.log(label.padEnd(34), JSON.stringify({ needChoice: !!v.needChoice, choiceOk: c ? c.ok : null, sync1: s1.ok, sync2: s2.ok, cloudXp: xp, guestStillThere: raw.getItem(GUEST_KEY) !== null, guestMarkedImported: !!st.doc.imported?.[gid], quarantineKept: quarantine === '{bad json' }));
}
await run('R-a 云端没有这次导入', false);
await run('R-b 云端其实已导入过（上传成功但待办没清）', true);
