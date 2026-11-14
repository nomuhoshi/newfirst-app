// 本机存储体检：不抛错、首次使用时间只记一次、键数统计、持久存储各种结果。node tests/storage-health.test.mjs
const mem = {}; let broken = false;
globalThis.localStorage = {
  getItem: (k) => { if (broken) throw new Error("denied"); return k in mem ? mem[k] : null; },
  setItem: (k, v) => { if (broken) throw new Error("denied"); mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const setNav = (storage) => Object.defineProperty(globalThis, "navigator", { value: { storage }, configurable: true });
const m = await import("../src/storage-health.js");

setNav(undefined); ok("不支持 storage：不抛错，说明浏览器不支持", (await m.ensurePersist()) === "浏览器不支持" && m.persistLabel() === "浏览器不支持");
setNav({ persist: async () => true, persisted: async () => false }); ok("批准持久存储", (await m.ensurePersist()) === "已持久");
setNav({ persist: async () => false, persisted: async () => false }); ok("没批准：说明里提示导出备份", /没有批准.*导出备份/.test(await m.ensurePersist()));
setNav({ persist: async () => { throw new Error("x"); }, persisted: async () => false }); ok("检查出错不抛错", (await m.ensurePersist()) === "检查出错");

const t1 = m.firstSeenAt(1000), t2 = m.firstSeenAt(9999); ok("首次使用时间只记第一次", t1 === 1000 && t2 === 1000);
mem["suipian.v4.tab.a"] = "x".repeat(100); mem["suipian.v4.epoch"] = "m0"; mem["other"] = "y";
const c = m.localCounts(); ok("键数统计：总数和学习记录相关数", c.keys === 4 && c.v4 === 2 && c.bytes > 100, JSON.stringify(c));
setNav({ estimate: async () => ({ usage: 5 * 1024 * 1024, quota: 1024 * 1024 * 1024 }) });
const rep = await m.storageReport(); ok("体检报告含首次使用、键数、持久、额度", rep.length >= 4 && /首次使用/.test(rep[0]) && /4 个键/.test(rep[1]) && /持久存储/.test(rep[2]) && /5 MB/.test(rep.at(-1)) && /1024 MB/.test(rep.at(-1)), rep.join(" | "));
broken = true; ok("存储被禁用：首次使用返回 0、键数 null、不抛错", m.firstSeenAt() === 0 && m.localCounts() === null);
const rep2 = await m.storageReport(); ok("存储被禁用：报告仍然生成", rep2.length >= 3 && /无法读取|读取失败/.test(rep2.join("")), rep2.join(" | "));

// ---- 14 天导出提醒 ----
broken = false; for (const k of Object.keys(mem)) delete mem[k];
const D = 24 * 3600 * 1000, T0 = 1_000_000_000_000;
ok("还没有起点：不提醒", !m.exportReminderDue({ now: T0 + 99 * D, doneCount: 5 }));
ok("没有进度时不建立起点", m.ensureBackupBase(0, T0) === 0);
ok("首次保存有效进度建立起点", m.ensureBackupBase(2, T0) === T0);
ok("起点只建一次，不被后来的保存覆盖", m.ensureBackupBase(9, T0 + 5 * D) === T0);
ok("刚开始用：不提醒", !m.exportReminderDue({ now: T0 + 15 * D, doneCount: 2 }));
ok("满 14 天但课太少：不提醒", !m.exportReminderDue({ now: T0 + 15 * D, doneCount: 2 }));
ok("不满 14 天：不提醒", !m.exportReminderDue({ now: T0 + 13 * D, doneCount: 5 }));
ok("满 14 天且有进度：提醒", m.exportReminderDue({ now: T0 + 15 * D, doneCount: 5 }));
ok("已登录账号：不提醒", !m.exportReminderDue({ now: T0 + 15 * D, doneCount: 5, signedIn: true }));
m.snoozeExport(T0 + 15 * D);
ok("点稍后：3 天内不提醒", !m.exportReminderDue({ now: T0 + 17 * D, doneCount: 5 }));
ok("稍后过期后再次提醒", m.exportReminderDue({ now: T0 + 18.5 * D, doneCount: 5 }));
m.markExported(T0 + 20 * D);
ok("导出成功后重新计时（并清掉稍后）", !m.exportReminderDue({ now: T0 + 33 * D, doneCount: 5 }) && m.lastExportAt() === T0 + 20 * D);
ok("导出后再满 14 天又提醒", m.exportReminderDue({ now: T0 + 35 * D, doneCount: 5 }));
broken = true;
ok("存储被禁用：不抛错、不提醒", m.exportReminderDue({ now: T0 + 99 * D, doneCount: 9 }) === false && m.markExported() === false && m.snoozeExport() === false);
// ---- 打开记录与探针 ----
broken = false; for (const k of Object.keys(mem)) delete mem[k];
m.recordLoad(1000); m.recordLoad(2000); m.recordLoad(3000);
ok("打开记录：每次打开累加", m.loadHistory().join() === "1000,2000,3000");
for (let i = 0; i < 12; i++) m.recordLoad(5000 + i);
ok("打开记录：只留最近 8 条", m.loadHistory().length === 8 && m.loadHistory().at(-1) === 5011);
mem["suipian.meta.loads"] = "{坏的"; ok("打开记录损坏：不抛错，重新记", m.recordLoad(7000).join() === "7000");
const pr = await m.browserProbe(); ok("探针：Cookie / localStorage / sessionStorage / IndexedDB 四行", pr.length === 4 && /localStorage 写入：正常/.test(pr[1]) && /IndexedDB/.test(pr[3]), pr.join("|"));
const rep3 = await m.storageReport(); ok("体检报告包含打开次数和探针", rep3.some((x) => /打开次数：1/.test(x)) && rep3.some((x) => /Cookie/.test(x)), rep3.join("|"));
broken = true; ok("存储被禁用：打开记录不抛错", m.recordLoad() === null && m.loadHistory() === null);
// ---- 旧版 lastExport 不当确认凭据 ----
broken = false; for (const k of Object.keys(mem)) delete mem[k];
mem["suipian.meta.backupBase"] = String(T0); mem["suipian.meta.lastExport"] = String(T0 + 14 * D); // 旧版点下载就写的时间
ok("旧版 lastExport 不当确认：到期仍提醒", m.exportReminderDue({ now: T0 + 15 * D, doneCount: 5 }) && m.lastExportAt() === 0);
m.markExported(T0 + 15 * D);
ok("用户确认后写入 confirmedExport 并重新计时", m.lastExportAt() === T0 + 15 * D && !m.exportReminderDue({ now: T0 + 20 * D, doneCount: 5 }));

// ---- F：存储探针只输出受支持的异常类别，不输出任意 name / message ----
// 全部使用本机内存对象和明显的合成字符串；不读真实存档、不发网络请求。
const FAKE_PRIVATE = "FAKE-PRIVATE token=TEST_TOKEN_123 user@example.invalid https://example.invalid/a?key=TEST#private";
const probeGlobals = ["navigator", "localStorage", "sessionStorage", "indexedDB"];
const beforeProbe = new Map(probeGlobals.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
const thrown = (name) => Object.assign(new Error(FAKE_PRIVATE), { name });
function probeMemory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k), key: (i) => [...values.keys()][i] ?? null, get length() { return values.size; } };
}
async function probeScene(options = {}) {
  const local = probeMemory(options.initial), session = probeMemory();
  const nav = { cookieEnabled: true, storage: { estimate: async () => ({ usage: 5 * 1024 * 1024, quota: 1024 * 1024 * 1024 }) } };
  if ("cookieError" in options) Object.defineProperty(nav, "cookieEnabled", { get() { throw options.cookieError; } });
  if ("localError" in options) local.setItem = () => { throw options.localError; };
  if ("sessionError" in options) session.setItem = () => { throw options.sessionError; };
  const idbCalls = [];
  let idb;
  if ("idbSyncError" in options) idb = { open() { throw options.idbSyncError; } };
  else if ("idbError" in options) idb = { open() { const r = { error: options.idbError }; queueMicrotask(() => r.onerror()); return r; } };
  else if (options.idb === "ok") idb = { open(name) { idbCalls.push("open:" + name); const r = { result: { close() { idbCalls.push("close"); } } }; queueMicrotask(() => r.onsuccess()); return r; }, deleteDatabase(name) { idbCalls.push("delete:" + name); } };
  else if (options.idb === "blocked") idb = { open() { const r = {}; queueMicrotask(() => r.onblocked()); return r; } };
  for (const [key, value] of Object.entries({ navigator: nav, localStorage: local, sessionStorage: session, indexedDB: idb })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  try { return { lines: await (options.report ? m.storageReport() : m.browserProbe()), local, session, idbCalls }; }
  finally { for (const [key, descriptor] of beforeProbe) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}
for (const [field, index, prefix] of [["cookieError", 0, "Cookie：出错："], ["localError", 1, "localStorage 写入：出错："], ["sessionError", 2, "sessionStorage：出错："], ["idbSyncError", 3, "IndexedDB：出错："], ["idbError", 3, "IndexedDB：被拒绝（"]]) {
  const end = field === "idbError" ? "）" : "";
  const normal = await probeScene({ [field]: thrown("SecurityError") });
  ok(`F ${field}：保留 SecurityError，不带异常 message`, normal.lines[index] === prefix + "SecurityError" + end && !normal.lines.join("\n").includes("FAKE-PRIVATE"), normal.lines.join(" | "));
  const unsafe = await probeScene({ [field]: thrown(FAKE_PRIVATE) });
  ok(`F ${field}：异常 name 含假邮箱 / URL / 令牌时只报未知类型`, unsafe.lines[index] === prefix + "未知类型" + end && !unsafe.lines.join("\n").includes("FAKE-PRIVATE"), unsafe.lines.join(" | "));
}
const quota = await probeScene({ localError: thrown("QuotaExceededError") });
ok("F 配额异常仍保留 QuotaExceededError", quota.lines[1] === "localStorage 写入：出错：QuotaExceededError");
for (const name of ["A".repeat(5000), "TEST_TOKEN_WITHOUT_PUNCTUATION", { toString() { throw new Error("must not coerce"); } }]) {
  let result;
  try { result = await probeScene({ localError: thrown(name) }); } catch { result = { lines: ["", "probe rejected"] }; }
  ok("F 过长 / 自定义标识符 / 非字符串 name：不原样输出也不强制转字符串", result.lines[1] === "localStorage 写入：出错：未知类型", result.lines[1]);
}
for (const value of [FAKE_PRIVATE, null, undefined]) {
  const result = await probeScene({ sessionError: value });
  ok("F 抛出字符串 / null / undefined：不泄露原值", result.lines[2] === "sessionStorage：出错：未知类型", result.lines[2]);
}
let getterResult;
try { getterResult = (await probeScene({ localError: Object.defineProperty({}, "name", { get() { throw new Error(FAKE_PRIVATE); } }) })).lines[1]; } catch { getterResult = "probe rejected"; }
ok("F name getter 自身抛错：探针仍返回未知类型", getterResult === "localStorage 写入：出错：未知类型", getterResult);
const goodProbe = await probeScene({ idb: "ok" });
ok("F 正常探针保持四行、成功关闭并删除自己的探针数据库", goodProbe.lines.join("|") === "Cookie：允许|localStorage 写入：正常|sessionStorage：正常|IndexedDB：可用" && goodProbe.idbCalls.join("|") === "open:suipian-probe|close|delete:suipian-probe" && !goodProbe.local.values.has("suipian.meta.probe") && !goodProbe.session.values.has("suipian.probe"), goodProbe.lines.join("|"));
const blockedProbe = await probeScene({ idb: "blocked" });
ok("F IndexedDB 被阻塞仍如实显示", blockedProbe.lines[3] === "IndexedDB：被阻塞");
const unchanged = { "suipian.meta.firstSeen": "1000", "suipian.meta.loads": "[1000,2000]", "suipian.v4.tab.keep": FAKE_PRIVATE };
const report = await probeScene({ initial: unchanged, sessionError: thrown(FAKE_PRIVATE), report: true });
ok("F 完整体检保留首次使用 / 键数 / 打开次数 / 额度", report.lines.some((x) => x.startsWith("这份存储首次使用：") && !x.includes("无法读取")) && report.lines.some((x) => x.includes("3 个键（学习记录相关 1 个）")) && report.lines.some((x) => x.includes("打开次数：2")) && report.lines.some((x) => x.includes("5 MB / 共 1024 MB")), report.lines.join(" | "));
ok("F 完整体检不带合成私人文本，已有学习记录和打开记录原样保留", !report.lines.join("\n").includes("FAKE-PRIVATE") && JSON.stringify(Object.fromEntries(report.local.values)) === JSON.stringify(unchanged), report.lines.join(" | "));
process.exit(fail ? 1 : 0);
