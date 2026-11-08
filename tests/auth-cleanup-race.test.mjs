// retryAuthCleanup() 的“最后一次检查 → 删除”之间的跨标签页竞争窗口。
// 旧实现：先读一次账号指针（p2）再调用 clearStoredAuthVerified()——后者盲删 AUTH_KEY，删不掉时还会把“撤销标记”写进去覆盖。
// 如果另一个标签页恰好在这两步之间登录（写了账号指针和新凭证），旧实现会把对方刚写的有效登录凭证删掉（或用撤销标记覆盖）。
// 新实现：只删“刚检查过的那一份原文”，删之前、写撤销标记之前都再读一次，已经不是那一份就停（kind:"changed"）。
// 运行：node --test tests/auth-cleanup-race.test.mjs     纯 Node，假存储，不联网。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, AUTH_KEY } from '../src/sync.js';
import { SESSION_KEY } from '../src/account-store.js';
import { freshState } from '../src/storage.js';

const NOW = 1_000_000, UID = 'uRace';
const sess = (rt, at = 'at') => ({ userId: UID, email: 'race@example.test', accessToken: at, refreshToken: rt, expiresAt: NOW + 3_600_000 });
const authRaw = (rt, at) => JSON.stringify({ session: sess(rt, at) });

function mem() {
  const m = new Map();
  const o = { _m: m, hooks: {}, log: [],
    getItem(k) { o.hooks.get?.(k, o); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { o.log.push(['set', k]); m.set(k, String(v)); },
    removeItem(k) { o.log.push(['remove', k]); if (o.hooks.remove?.(k, o) === 'silent') return; m.delete(k); } };
  return o;
}
// 状态：已退出（没有账号指针），本机留着一份退出时没清掉的旧凭证（leftover），retryAuthCleanup 是用户点的“清理本机残留的登录凭证”
function setup({ seedLeftover = true } = {}) {
  const raw = mem();
  if (seedLeftover) raw.setItem(AUTH_KEY, authRaw('rt-old', 'at-old'));
  const sync = createSync({ storage: raw, api: { async signOut() { return { ok: true }; }, async refresh() { throw Error('no'); } }, now: () => NOW, today: () => '2026-11-05', schedule: () => 1 });
  sync.restore(freshState());
  raw.log.length = 0;
  return { raw, sync };
}
// 另一个标签页“刚刚登录”：账号指针 + 新凭证（refresh token 不同）
const otherTabLogsIn = (o) => { o._m.set(SESSION_KEY, UID); o._m.set(AUTH_KEY, authRaw('rt-new', 'at-new')); };

test('A1: 对照：没有竞争时，残留凭证被清掉并读回确认', async () => {
  const { raw, sync } = setup();
  assert.equal(sync.hasLeftoverAuth(), true);
  const r = await sync.retryAuthCleanup();
  assert.equal(r.ok, true); assert.notEqual(r.nothingToClean, true);
  assert.equal(raw._m.has(AUTH_KEY), false);
});

test('A2: 竞争①——最后一次账号指针检查之后、删除之前，另一个标签页登录了：不能删对方刚写的凭证', async () => {
  const { raw, sync } = setup();
  let pointerReads = 0;
  raw.hooks.get = (k, o) => { if (k === SESSION_KEY && ++pointerReads === 2 && !o.flags?.done) { o.flags = { done: true }; otherTabLogsIn(o); } };
  // 第 1 次读指针是入口检查，第 2 次是“动手前再确认一次”（p2）；对方在 p2 读完之后登录（hook 在读之前改存储会被 p2 看到，所以用第 3 次读 = 紧随其后的任何读取）
  raw.hooks.get = (k, o) => { if (k === SESSION_KEY) { pointerReads++; } if (k === AUTH_KEY && pointerReads >= 2 && !o.flags?.done) { o.flags = { done: true }; otherTabLogsIn(o); } };
  const r = await sync.retryAuthCleanup();
  assert.equal(r.ok, false, '不能宣称清理成功'); assert.equal(r.kind, 'changed');
  assert.equal(raw._m.get(AUTH_KEY), authRaw('rt-new', 'at-new'), '对方刚写的有效登录凭证必须原样保留');
  assert.equal(raw._m.get(SESSION_KEY), UID);
  assert.equal(raw.log.filter(([op, k]) => op === 'remove' && k === AUTH_KEY).length, 0, '没有对凭证键发起任何删除');
});

test('A3: 竞争②——删除静默无效、改写撤销标记之前，另一个标签页登录了：不能用撤销标记覆盖对方的新凭证', async () => {
  const { raw, sync } = setup();
  raw.hooks.remove = (k) => (k === AUTH_KEY ? 'silent' : undefined);      // 本标签页的删除没生效（存储权限问题），于是会走“写撤销标记”的兜底
  raw.hooks.get = (k, o) => { if (k === AUTH_KEY && o.log.some(([op, kk]) => op === 'remove' && kk === AUTH_KEY) && !o.flags?.done) { o.flags = { done: true }; otherTabLogsIn(o); } };
  const r = await sync.retryAuthCleanup();
  assert.equal(r.ok, false); assert.equal(r.kind, 'changed');
  assert.equal(raw._m.get(AUTH_KEY), authRaw('rt-new', 'at-new'), '撤销标记不能覆盖对方的新凭证');
  assert.equal(raw.log.filter(([op, k]) => op === 'set' && k === AUTH_KEY).length, 0, '没有往凭证键写任何东西');
});

test('A4: 竞争③——对方在读回之前把凭证“刷新”成新令牌（同一账号的正常刷新）：同样不清、不覆盖', async () => {
  const { raw, sync } = setup();
  raw.hooks.get = (k, o) => { if (k === AUTH_KEY && o.log.some(([op, kk]) => op === 'remove' && kk === AUTH_KEY) === false && o.flags?.armed && !o.flags.done) { o.flags.done = true; o._m.set(AUTH_KEY, authRaw('rt-rotated', 'at-rotated')); } };
  raw.flags = { armed: false };
  // 在 inspectAuth 之后、清理之前轮换：用“第 2 次读凭证”触发
  let authReads = 0; const base = raw.hooks.get;
  raw.hooks.get = (k, o) => { if (k === AUTH_KEY) { authReads++; if (authReads === 2 && !o.flags.done) { o.flags.done = true; o._m.set(AUTH_KEY, authRaw('rt-rotated', 'at-rotated')); } } };
  const r = await sync.retryAuthCleanup();
  assert.equal(r.ok, false); assert.equal(r.kind, 'changed');
  assert.equal(raw._m.get(AUTH_KEY), authRaw('rt-rotated', 'at-rotated'));
  void base;
});

test('A5: 清理失败后“残留”标记不丢：被判 changed 之后用户还能再点（对方登出后可以清掉）', async () => {
  const { raw, sync } = setup();
  let authReads = 0;
  raw.hooks.get = (k, o) => { if (k === AUTH_KEY) { authReads++; if (authReads === 2 && !o.flags?.done) { o.flags = { done: true }; o._m.set(AUTH_KEY, authRaw('rt-rotated', 'at-rotated')); } } };
  assert.equal((await sync.retryAuthCleanup()).kind, 'changed');
  raw.hooks.get = null; raw._m.delete(SESSION_KEY);
  assert.equal(sync.hasLeftoverAuth(), true, '入口还在');
  const r = await sync.retryAuthCleanup();
  assert.equal(r.ok, true); assert.equal(raw._m.has(AUTH_KEY), false);
});
