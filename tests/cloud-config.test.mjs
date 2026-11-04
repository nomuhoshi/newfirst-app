// 云端配置的隔离规则：测试入口（构建时设了 PREVIEW_ID）绝不连正式 Supabase 项目。
// 纯函数测试：每次给 globalThis 设不同的构建常量，再用不同查询串重新导入模块。
// 运行：node tests/cloud-config.test.mjs
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + d : ""}`); };
const PROD_URL = "https://aqlcunkmggzzvyavlkjg.supabase.co";
let n = 0;
async function load({ id, test } = {}) {
  delete globalThis.__PREVIEW_ID__; delete globalThis.__TEST_CLOUD__;
  if (id !== undefined) globalThis.__PREVIEW_ID__ = id;
  if (test !== undefined) globalThis.__TEST_CLOUD__ = test;
  return (await import(`../src/cloud-config.js?case=${++n}`)).CLOUD;
}
const prod = await load();
check("正式构建（没设 PREVIEW_ID）：用正式项目", prod.url === PROD_URL && prod.anonKey.length > 10, JSON.stringify(prod));
const prod2 = await load({ id: "", test: { url: "https://test.supabase.co", anonKey: "k" } });
check("正式构建即使有测试配置也不读：仍用正式项目", prod2.url === PROD_URL);
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
const failed = results.filter((r) => !r).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
