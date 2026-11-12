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

console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
