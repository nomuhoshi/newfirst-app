// 云端配置的隔离规则：测试入口（构建时设了 PREVIEW_ID）绝不连正式 Supabase 项目。
// 纯函数测试：每次给 globalThis 设不同的构建常量，再用不同查询串重新导入模块。
// 运行：node tests/cloud-config.test.mjs
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + d : ""}`); };
const PROD_URL = "https://aqlcunkmggzzvyavlkjg.supabase.co";
let n = 0;
async function load({ id, test, live } = {}) {
  delete globalThis.__PREVIEW_ID__; delete globalThis.__TEST_CLOUD__; delete globalThis.__ACCOUNTS_LIVE__;
  if (live !== undefined) globalThis.__ACCOUNTS_LIVE__ = live;
  if (id !== undefined) globalThis.__PREVIEW_ID__ = id;
  if (test !== undefined) globalThis.__TEST_CLOUD__ = test;
  return (await import(`../src/cloud-config.js?case=${++n}`)).CLOUD;
}
// 账号发布开关（2026-11-11）：正式构建默认关闭 = 云端未开通；打开后才连正式项目
const off = await load();
check("正式构建，账号开关默认关闭：云端关闭（网址和密钥都为空，不会连正式项目）", off.url === "" && off.anonKey === "", JSON.stringify(off));
const offExplicit = await load({ live: false });
check("正式构建，开关明确为 false：云端关闭", offExplicit.url === "" && offExplicit.anonKey === "");
const offTruthy = await load({ live: "true" });
check("开关只认布尔 true：字符串 \"true\" 不算打开", offTruthy.url === "");
const prod = await load({ live: true });
check("正式构建，开关打开：用正式项目", prod.url === PROD_URL && prod.anonKey.length > 10, JSON.stringify(prod));
const prod2 = await load({ id: "", test: { url: "https://test.supabase.co", anonKey: "k" }, live: true });
check("正式构建即使有测试配置也不读：仍用正式项目", prod2.url === PROD_URL);
const prevLive = await load({ id: "rc1", test: { url: "https://abcdefgh.supabase.co", anonKey: "sb_publishable_test" }, live: false });
check("测试入口不受账号开关影响：照常用测试项目", prevLive.url === "https://abcdefgh.supabase.co");
const none = await load({ id: "rc1" });
check("测试入口没给测试项目：云端关闭（网址和密钥都为空）", none.url === "" && none.anonKey === "");
const empty = await load({ id: "rc1", test: { url: "", anonKey: "" } });
check("测试入口给的是空配置：云端关闭", empty.url === "" && empty.anonKey === "");
const ok = await load({ id: "rc1", test: { url: "https://abcdefgh.supabase.co", anonKey: "sb_publishable_test" } });
check("测试入口给了独立测试项目：用它，不碰正式项目", ok.url === "https://abcdefgh.supabase.co" && ok.anonKey === "sb_publishable_test");
const same = await load({ id: "rc1", test: { url: PROD_URL, anonKey: "x" } });
check("测试入口填成正式项目的网址：被拒绝，云端关闭", same.url === "" && same.anonKey === "");
const sameRef = await load({ id: "pr11", test: { url: "https://aqlcunkmggzzvyavlkjg.supabase.co/", anonKey: "x" } });
check("网址只是多了个斜杠也认得出是正式项目：被拒绝", sameRef.url === "");
const bad = await load({ id: "rc1", test: { url: 123, anonKey: null } });
check("配置格式不对：云端关闭，不抛错", bad.url === "" && bad.anonKey === "");
const upper = await load({ id: "rc1", test: { url: "HTTPS://AQLCUNKMGGZZVYAVLKJG.Supabase.CO", anonKey: "x" } });
check("正式项目主机名写成大写：照样认出，被拒绝", upper.url === "");
const port = await load({ id: "rc1", test: { url: "https://user:pw@AqlCunkmggzzvyavlkjg.supabase.co:443/rest/v1?x=1", anonKey: "x" } });
check("带端口 / 用户信息 / 路径的正式网址：被拒绝", port.url === "");
const junk = await load({ id: "rc1", test: { url: "not a url", anonKey: "x" } });
check("网址解析不了：当作不安全，云端关闭", junk.url === "");
const ftp = await load({ id: "rc1", test: { url: "ftp://abcdefgh.supabase.co", anonKey: "x" } });
check("不是 http(s) 的网址：云端关闭", ftp.url === "");
const spaced = await load({ id: "rc1", test: { url: "  https://AbCdEfGh.supabase.co  ", anonKey: " k " } });
check("测试项目网址前后有空格、含大写：去掉空格后照常使用", spaced.url === "https://AbCdEfGh.supabase.co" && spaced.anonKey === "k");
const m = await import("../src/cloud-config.js?case=host");
check("hostOf 小写化主机名；解析不了返回空", m.hostOf("https://ABC.supabase.co/x") === "abc.supabase.co" && m.hostOf("zzz") === "" && m.PROD_HOST === "aqlcunkmggzzvyavlkjg.supabase.co");
const failed = results.filter((r) => !r).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
