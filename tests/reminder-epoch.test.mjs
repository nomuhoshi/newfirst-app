// 备份提醒记录按代数隔离：清除学习记录后新一代重新计时；旧确认 / 稍后 / 起点不影响新一代，且不被删除。纯 node。
const mem = {};
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; } };
const H = await import("../src/storage-health.js");
const { loadState, saveState, clearState, addXp } = await import("../src/storage.js");
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const DAY = 24 * 3600 * 1000, now = Date.now();
const metaKeys = () => Object.keys(mem).filter((k) => k.startsWith("suipian.meta.")).sort();

// 从没清除过：沿用原来的键（老用户不用迁移）
loadState();
H.ensureBackupBase(3, now - 20 * DAY);
ok("E1 从没清除过：起点写在原来的键", mem["suipian.meta.backupBase"] === String(now - 20 * DAY));
ok("E1 20 天前起算、3 个关卡：到期提醒", H.exportReminderDue({ now, doneCount: 3 }) === true);
H.markExported(now - 15 * DAY); H.snoozeExport(now - 15 * DAY);
ok("E1 15 天前确认过备份：到期（超过 14 天）", H.exportReminderDue({ now, doneCount: 3 }) === true);
H.markExported(now - 1 * DAY);
ok("E1 昨天确认过：不提醒", H.exportReminderDue({ now, doneCount: 3 }) === false);
const old = { ...mem };

// 用户明确清除学习记录：新一代
const f = clearState(); ok("E2 清除成功", !f.clearFailed);
ok("E2 新一代没有起点、没有确认：不提醒", H.backupBaseAt() === 0 && H.lastExportAt() === 0 && H.exportReminderDue({ now: now + 100 * DAY, doneCount: 5 }) === false);
ok("E2 旧代的确认 / 稍后 / 起点没有被删除", ["suipian.meta.backupBase", "suipian.meta.confirmedExport", "suipian.meta.exportSnooze"].every((k) => mem[k] === old[k]), JSON.stringify(metaKeys()));
ok("E2 还没有学习进度：不建立起点", H.ensureBackupBase(0, now) === 0 && metaKeys().length === Object.keys(old).filter((k) => k.startsWith("suipian.meta.")).length);

// 新一代首次有效进度保存成功后才建立起点，写在带代数的新键里
H.ensureBackupBase(1, now);
const nk = metaKeys().filter((k) => k.startsWith("suipian.meta.backupBase."));
ok("E3 新一代起点写在带代数的新键里，原键不变", nk.length === 1 && H.backupBaseAt() === now && mem["suipian.meta.backupBase"] === old["suipian.meta.backupBase"], JSON.stringify(nk));
ok("E3 新一代 13 天内不提醒、14 天后提醒（旧确认 / 稍后不影响）", H.exportReminderDue({ now: now + 13 * DAY, doneCount: 3 }) === false && H.exportReminderDue({ now: now + 15 * DAY, doneCount: 3 }) === true);
H.markExported(now + 15 * DAY);
ok("E3 新一代确认后重新计时，只写新键", H.lastExportAt() === now + 15 * DAY && mem["suipian.meta.confirmedExport"] === old["suipian.meta.confirmedExport"] && H.exportReminderDue({ now: now + 16 * DAY, doneCount: 3 }) === false);
H.snoozeExport(now + 30 * DAY);
ok("E3 稍后记录同样按代数", metaKeys().some((k) => k.startsWith("suipian.meta.exportSnooze.")) && mem["suipian.meta.exportSnooze"] === old["suipian.meta.exportSnooze"]);

// 再清除一次：又是新的一代，之前两代都不影响
clearState();
ok("E4 再次清除：重新没有起点，不提醒", H.backupBaseAt() === 0 && H.lastExportAt() === 0 && H.exportReminderDue({ now: now + 200 * DAY, doneCount: 5 }) === false);

// 读不到代数：当作没有记录，不写
const og = localStorage.getItem; localStorage.getItem = (k) => { if (k === "suipian.v4.epoch") throw new Error("denied"); return og(k); };
const cnt = Object.keys(mem).length;
ok("E5 读不到代数：不写、不提醒", H.ensureBackupBase(3, now) === 0 && H.markExported(now) === false && H.snoozeExport(now) === false && Object.keys(mem).length === cnt && H.exportReminderDue({ now: now + 999 * DAY, doneCount: 9 }) === false);
localStorage.getItem = og;

// ---------- 确定性交错（GPT1 / 产品官 00:20）：提醒操作进行中另一页清除 ----------
// 做法：在这次操作的第 K 次存储调用（读 / 写 / 删）之前先让“另一页”清除，K 从 1 扫到操作的最后一次调用；
// 每个 K 都核对：新一代的提醒键一个也没有出现（不改新代记录）、旧代键保持、返回值不把换代报成成功、提醒判断只来自一代。
{ const { stateEpoch } = await import("../src/storage.js");
  const realG = localStorage.getItem, realS = localStorage.setItem, realR = localStorage.removeItem;
  let calls = 0, fireAt = 0, fire = null;
  const tick = () => { calls++; if (fire && calls === fireAt) { const f = fire; fire = null; f(); } };
  localStorage.getItem = (k) => { tick(); return realG(k); }; localStorage.setItem = (k, v) => { tick(); return realS(k, v); }; localStorage.removeItem = (k) => { tick(); return realR(k); };
  const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; fire = null; calls = 0; };
  const metas = () => Object.keys(mem).filter((k) => k.startsWith("suipian.meta.") && /(backupBase|confirmedExport|exportSnooze)/.test(k)).sort();
  // 旧代：已有起点和确认；然后跑操作 op，在第 K 次存储调用前清除
  const scan = (name, setup, op, check) => {
    reset(); loadState(); setup(); const before = metas(); const oldEpoch = realG("suipian.v4.epoch") || "m0";
    calls = 0; fire = null; op(); const total = calls; // 先空跑一遍数调用次数（不清除）
    let bad = 0;
    for (let K = 2; K <= total; K++) { // K=1 是“读代数”本身：在它之前清除 = 操作从新一代开始，不是交错
      reset(); loadState(); setup(); const b0 = metas(); const E0 = realG("suipian.v4.epoch") || "m0";
      let newEpoch = null; fireAt = K; calls = 0;
      fire = () => { const g = localStorage.getItem, st = localStorage.setItem, rm = localStorage.removeItem; localStorage.getItem = realG; localStorage.setItem = realS; localStorage.removeItem = realR; clearState(); newEpoch = realG("suipian.v4.epoch"); localStorage.getItem = g; localStorage.setItem = st; localStorage.removeItem = rm; };
      const r = op();
      fire = null;
      const newKeys = metas().filter((k) => k.endsWith("." + newEpoch));
      const touched = b0.some((k) => !metas().includes(k));
      const msg = check({ r, K, newKeys, touched, newEpoch });
      if (newKeys.length || touched || msg) { bad++; console.log(`❌ ${name} K=${K}/${total}：新代键=${newKeys.join()} 旧键被删=${touched} ${msg || ""}`); }
    }
    ok(`${name}：在每个存储调用点注入清除（共 ${total} 个点），新一代提醒记录从不被改动`, bad === 0 && total >= 3, `bad=${bad} total=${total}`);
  };
  const oldSetup = () => { H.ensureBackupBase(3, now - 20 * DAY); H.markExported(now - 15 * DAY); };
  scan("J1 确认备份 markExported", oldSetup, () => H.markExported(now), ({ r }) => (r !== false || H.getLastReminderStatus() !== "epoch" ? "操作中换代，却没有报“换代”（返回 " + r + "，状态 " + H.getLastReminderStatus() + "）" : ""));
  scan("J2 稍后 snoozeExport", oldSetup, () => H.snoozeExport(now), ({ r }) => (r !== false || H.getLastReminderStatus() !== "epoch" ? "操作中换代，却没有报“换代”（返回 " + r + "，状态 " + H.getLastReminderStatus() + "）" : ""));
  scan("J3 建立起点 ensureBackupBase", () => {}, () => H.ensureBackupBase(2, now), ({ r }) => (r !== 0 ? "操作中换代，却返回了起点 " + r : ""));
  // 到期判断只来自一代：旧代确认过（20 天前）且“稍后”设在未来 → 旧代视角不到期；新代没有任何记录 → 不到期。混读（旧确认 + 新稍后=0）会得出“到期”。
  scan("J4 到期判断 exportReminderDue 只来自一代", () => { H.markExported(now - 20 * DAY); H.snoozeExport(now + 50 * DAY); }, () => H.exportReminderDue({ now, doneCount: 5 }), ({ r }) => (r !== false ? "混读了两代：返回 " + r : ""));
  // 起点所依据的保存属于旧代：保存成功后、建立起点之前发生清除 → 不建立（新代没有进度，旧代的保存不能给新代起算）
  { reset(); loadState(); const A = (await import("../src/storage.js")).loadState().state; addXp(A, 10, "U1L1", true); A.done.U1L1 = true; A.lessonsCompleted = 1; A.lastDay = "2026-11-12"; A.streak = 1;
    ok("J5 保存成功", saveState(A) === true && stateEpoch(A) === (realG("suipian.v4.epoch") || "m0"));
    const sEpoch = stateEpoch(A); clearState(); const n0 = metas().length;
    ok("J5 保存之后别页清除：依据旧代保存建立起点 → 不写任何键", H.ensureBackupBase(1, now, sEpoch) === 0 && metas().length === n0 && H.backupBaseAt() === 0, metas().join());
    ok("J5 同一代的保存 → 正常建立", H.ensureBackupBase(1, now, (realG("suipian.v4.epoch") || "m0")) === now && H.backupBaseAt() === now); }
  localStorage.getItem = realG; localStorage.setItem = realS; localStorage.removeItem = realR;
}

console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
