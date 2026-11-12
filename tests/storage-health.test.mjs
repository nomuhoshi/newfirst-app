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
process.exit(fail ? 1 : 0);
