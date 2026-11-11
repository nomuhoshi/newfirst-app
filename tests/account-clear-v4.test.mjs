// 账号接管清除游客记录（v4 存储）：返回值准确、失败可重试、不误删。node tests/account-clear-v4.test.mjs
const mem = {}; let failEpoch = false;
const store = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { if (failEpoch && k.endsWith(".epoch")) throw new Error("quota"); mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
globalThis.localStorage = store;
const { loadState, saveState, addXp, addRun } = await import("../src/storage.js");
const { clearGuestAfterVerified, readGuestRaw, readGuest } = await import("../src/account-store.js");
const { emptyDoc, docsEquivalent } = await import("../src/account-data.js");
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };

const s = loadState().state; addXp(s, 60, "U1L1", true); s.done.U1L1 = true; addRun(s); s.onboarded = true; s.lastDay = "2026-11-12"; s.streak = 1; saveState(s);
const snapshot = readGuestRaw(store);                       // 账号接管时用的游客记录快照（完整 v4 合并视图）
const doc = emptyDoc(); const args = { userChoseTransfer: true, uploadOk: true, uploaded: doc, readBack: doc, guestSnapshotRaw: snapshot };
ok("准备：游客记录读到 XP 60、一关", JSON.parse(snapshot).xp === 60 && readGuest(store).status === "ok" && docsEquivalent(doc, doc));

failEpoch = true; const r1 = clearGuestAfterVerified(store, args); failEpoch = false;
ok("v4 清除失败：返回 false（不能报成功）", r1 === false);
ok("失败后游客记录仍在，没有被误删", readGuestRaw(store) === snapshot && JSON.parse(readGuestRaw(store)).xp === 60);
const r2 = clearGuestAfterVerified(store, args);
ok("重试成功：返回 true，游客记录清空", r2 === true && JSON.parse(readGuestRaw(store)).xp === 0);
ok("重复调用：快照对不上，不再清除（返回 false），不影响已清空的记录", clearGuestAfterVerified(store, args) === false);
// 只有旧键（没有 v4）的存储：行为不变
for (const k of Object.keys(mem)) delete mem[k];
mem["suipian.progress"] = JSON.stringify({ version: 3, xp: 9 });
const legacySnap = mem["suipian.progress"];
ok("旧键存储（无 v4）：清除成功并删除旧键", clearGuestAfterVerified(store, { ...args, guestSnapshotRaw: legacySnap }) === true && !("suipian.progress" in mem));
process.exit(fail ? 1 : 0);
