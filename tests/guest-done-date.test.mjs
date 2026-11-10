// 问题①：游客做完的关卡合并进账号后，云端记录要有“第一次完成日期”（以前一律写空）。
// 规则：优先用本机记下的 doneOn；旧记录没有时，只在“能证明”的情况下推断（总共只完成过 1 次、只有 1 关 → 日期就是 lastDay）；其余写空，不编造。
// 运行：node tests/guest-done-date.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { guestToDoc, mergeGuestProgress, mergeDocs, syncStateIntoDoc, normalizeDoc, guestFingerprint, emptyDoc } from "../src/account-data.js";

const DEV = "d1aaaaaa", GUEST = "g1bbbbbb";
const base = (over = {}) => ({ version: 3, onboarded: true, xp: 40, hearts: 5, heartsAt: 0, streak: 1, lastDay: "2026-11-04", done: { U1L1: true }, lessonsCompleted: 1, installTipClosed: false, lastActive: 0, prefs: { sound: true, haptics: true, soundStyle: "J" }, ...over });
const NOW = Date.UTC(2026, 10, 5);

test("G1 本机记了 doneOn：每一关带上自己的日期", () => {
  const g = base({ done: { U1L1: true, U1L2: true }, doneOn: { U1L1: "2026-11-03", U1L2: "2026-11-04" }, lessonsCompleted: 3, streak: 2 });
  const r = guestToDoc(g, { deviceId: DEV, guestId: GUEST, now: NOW });
  assert.equal(r.ok, true);
  assert.deepEqual(r.doc.done, { U1L1: "2026-11-03", U1L2: "2026-11-04" });
});
test("G2 旧记录（没有 doneOn）：只完成过 1 次且只有 1 关 → 日期必为 lastDay", () => {
  const r = guestToDoc(base(), { deviceId: DEV, guestId: GUEST, now: NOW });
  assert.equal(r.doc.done.U1L1, "2026-11-04");
});
test("G3 旧记录无法证明时写空，不编造：多关、或完成次数不止 1 次", () => {
  const a = guestToDoc(base({ done: { U1L1: true, U1L2: true }, lessonsCompleted: 2, streak: 2 }), { deviceId: DEV, guestId: GUEST, now: NOW });
  assert.deepEqual(a.doc.done, { U1L1: "", U1L2: "" });
  const b = guestToDoc(base({ lessonsCompleted: 2 }), { deviceId: DEV, guestId: GUEST, now: NOW }); // 做过一次复习，不能证明第一次是哪天
  assert.equal(b.doc.done.U1L1, "");
  const c = guestToDoc(base({ lastDay: null }), { deviceId: DEV, guestId: GUEST, now: NOW });
  assert.equal(c.doc.done.U1L1, "");
});
test("G4 doneOn 里是坏日期（不存在的日期 / 非字符串）当作未知，不进云端", () => {
  const r = guestToDoc(base({ done: { U1L1: true, U1L2: true }, lessonsCompleted: 2, doneOn: { U1L1: "2026-02-31", U1L2: 5 } }), { deviceId: DEV, guestId: GUEST, now: NOW });
  assert.deepEqual(r.doc.done, { U1L1: "", U1L2: "" });
  assert.equal(normalizeDoc(r.doc).ok, true);
});
test("G5 doneOn 不进指纹：同一份学习记录补上日期后，指纹不变（不会触发“游客记录变了”）", () => {
  const g = base();
  assert.equal(guestFingerprint(g), guestFingerprint({ ...g, doneOn: { U1L1: "2026-11-04" } }));
});
test("G6 安全合并进已有云端文档：云端缺日期就补上，云端已有的日期取较早的，不被游客覆盖", () => {
  const cloud = emptyDoc({ gen: 3, lineage: "L1aaaaaa" });
  cloud.done = { U1L1: "", U1L2: "2026-11-01" };
  const g = base({ done: { U1L1: true, U1L2: true }, doneOn: { U1L1: "2026-11-03", U1L2: "2026-11-04" }, lessonsCompleted: 2, streak: 2 });
  const r = mergeGuestProgress(g, { deviceId: DEV, guestId: GUEST, cloudDoc: cloud, now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.doc.done.U1L1, "2026-11-03");
  assert.equal(r.doc.done.U1L2, "2026-11-01");
});
test("G7 登录后新完成的关：用本机 doneOn（不是同步那天）；原来日期未知的关补上日期", () => {
  const doc = emptyDoc({ gen: 1, lineage: "L1aaaaaa" });
  doc.done = { U1L1: "" };
  const st = base({ xp: 0, lessonsCompleted: 0, streak: 0, lastDay: null, done: { U1L1: true, U1L2: true }, doneOn: { U1L1: "2026-11-02", U1L2: "2026-11-03" } });
  const { doc: out, changed } = syncStateIntoDoc(doc, st, { deviceId: DEV, today: "2026-11-09", now: NOW });
  assert.equal(out.done.U1L1, "2026-11-02");
  assert.equal(out.done.U1L2, "2026-11-03");
  assert.equal(changed.done, true);
});
test("G8 没有 doneOn 的新完成关卡仍用同步当天（行为不变）；已有日期不被改写", () => {
  const doc = emptyDoc({ gen: 1, lineage: "L1aaaaaa" });
  doc.done = { U1L1: "2026-11-01" };
  const st = base({ xp: 0, lessonsCompleted: 0, streak: 0, lastDay: null, done: { U1L1: true, U1L2: true }, doneOn: { U1L1: "2026-11-09" } });
  const { doc: out } = syncStateIntoDoc(doc, st, { deviceId: DEV, today: "2026-11-09", now: NOW });
  assert.equal(out.done.U1L1, "2026-11-01");
  assert.equal(out.done.U1L2, "2026-11-09");
});
test("G9 两台设备合并：日期取较早的，空的让位给有日期的", () => {
  const a = emptyDoc({ gen: 1, lineage: "L1aaaaaa" }); a.done = { U1L1: "" };
  const b = emptyDoc({ gen: 1, lineage: "L1aaaaaa" }); b.done = { U1L1: "2026-11-03" };
  const m = mergeDocs(a, b);
  assert.equal(m.doc.done.U1L1, "2026-11-03");
});
