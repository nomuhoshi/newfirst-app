// 数据库权限复核（docs/35）补充的对抗测试，针对候选版 release/rc-1 的 cloud-config.js 与 sync.js。纯 Node，不联网。
// 运行：node tests/cloud-adversarial.test.mjs
// 说明：这里的“令牌”都是假字符串；只验证客户端规则（不把凭证交给不对应的项目、不跨账号带走数据），不能代替真实 Supabase 的令牌验证。
import { createSync, AUTH_KEY, STALE_KEY, scopedStorage, projectNamespace } from "../src/sync.js";
import { saveAccount, setCurrentAccount, loadAccount, getCurrentAccount } from "../src/account-store.js";
import { emptyDoc } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const PROD = "aqlcunkmggzzvyavlkjg.supabase.co", TEST = "abcdefgh.supabase.co";

// ---------- A. cloud-config：各种写法的“正式项目网址”都必须被识别并拒绝 ----------
let n = 0;
async function load({ id, test, loc, ls } = {}) {
  for (const k of ["__PREVIEW_ID__", "__TEST_CLOUD__", "location", "localStorage"]) delete globalThis[k];
  if (id !== undefined) globalThis.__PREVIEW_ID__ = id;
  if (test !== undefined) globalThis.__TEST_CLOUD__ = test;
  if (loc) globalThis.location = { hostname: loc };
  if (ls !== undefined) globalThis.localStorage = { getItem: () => ls };
  return (await import(`../src/cloud-config.js?adv=${++n}`)).CLOUD;
}
const blocked = async (label, url) => { const c = await load({ id: "rc1", test: { url, anonKey: "x" } }); check(`测试入口填「${label}」：被拒绝，云端关闭`, c.url === "" && c.anonKey === "", JSON.stringify(c)); };
await blocked("主机名末尾多一个点", "https://aqlcunkmggzzvyavlkjg.supabase.co./");
await blocked("全角字符写的主机名", "https://ａｑｌｃｕｎｋｍｇｇｚｚｖｙａｖｌｋｊｇ.supabase.co");
await blocked("百分号编码的点", "https://aqlcunkmggzzvyavlkjg%2esupabase.co");
await blocked("大写协议 + 反斜杠", "HTTPS:\\\\aqlcunkmggzzvyavlkjg.supabase.co");
await blocked("正式项目编号当作子域名前缀", "https://aqlcunkmggzzvyavlkjg.evil.example");
await blocked("正式项目编号嵌在别的主机名里", "https://x-aqlcunkmggzzvyavlkjg-y.example.com");
await blocked("javascript: 网址", "javascript:alert(1)");
await blocked("data: 网址", "data:text/plain,aqlcunkmggzzvyavlkjg");
await blocked("协议相对网址（没有协议）", "//aqlcunkmggzzvyavlkjg.supabase.co");
await blocked("只有空白", "   ");
{ const c = await load({ id: "rc1", test: { url: "https://aqlcunkmggzzvyavlkjg.supabase.co@evil.example/", anonKey: "x" } });
  console.log(`ℹ️  记录（不计入通过/失败）：用户信息里放正式网址、实际主机是 evil.example → CLOUD.url = ${c.url || "空（已屏蔽）"}；按实际主机判断，构建配置由发布的人负责`); }
{ const c = await load({ id: "rc1", test: { url: "https://abcdefgh.supabase.co", anonKey: "k" } });
  check("对照：合法的独立测试项目照常放行", c.url === "https://abcdefgh.supabase.co"); }
{ const c = await load({ id: "", test: { url: "https://abcdefgh.supabase.co", anonKey: "k" } });
  check("对照：正式构建（PREVIEW_ID 为空）忽略测试配置，仍是正式项目", c.url === "https://aqlcunkmggzzvyavlkjg.supabase.co"); }
// 本机（localhost）浏览器设置覆盖：测试入口读取覆盖值时同样要检查正式项目（17:14 决定；此前这里是“记录项”，现在是强制断言）
const LS = (url) => JSON.stringify({ url, anonKey: "x" });
for (const [label, url] of [["正式网址原样", "https://aqlcunkmggzzvyavlkjg.supabase.co"], ["大写", "HTTPS://AQLCUNKMGGZZVYAVLKJG.Supabase.CO"], ["末尾多一个点", "https://aqlcunkmggzzvyavlkjg.supabase.co./"], ["带端口 / 路径 / 用户信息", "https://u:p@aqlcunkmggzzvyavlkjg.supabase.co:443/rest/v1?x=1"], ["项目编号当子域名前缀", "https://aqlcunkmggzzvyavlkjg.evil.example"], ["解析不了的网址", "not a url"], ["javascript: 网址", "javascript:alert(1)"], ["只有空白", "   "]]) {
  for (const host of ["localhost", "127.0.0.1"]) {
    const c = await load({ id: "rc1", loc: host, ls: LS(url) });
    check(`测试入口 + ${host} 浏览器设置里写「${label}」：被拒绝，云端关闭`, c.url === "" && c.anonKey === "", JSON.stringify(c));
  }
}
{ const c = await load({ id: "pr11", loc: "localhost", ls: LS("https://aqlcunkmggzzvyavlkjg.supabase.co"), test: { url: "https://abcdefgh.supabase.co", anonKey: "k" } });
  check("测试入口 + localhost 覆盖写正式网址、构建时给了合法测试项目：仍关闭云端，不退回去用构建时的配置也不连正式项目", c.url === "" && c.anonKey === "", JSON.stringify(c)); }
{ const c = await load({ id: "rc1", loc: "localhost", ls: LS("http://localhost:54321") });
  check("对照：测试入口 + localhost 覆盖写本机假服务器地址：照常使用（自动测试靠这个）", c.url === "http://localhost:54321" && c.anonKey === "x", JSON.stringify(c)); }
{ const c = await load({ id: "rc1", loc: "localhost", ls: LS("https://abcdefgh.supabase.co") });
  check("对照：测试入口 + localhost 覆盖写独立测试项目：照常使用", c.url === "https://abcdefgh.supabase.co", JSON.stringify(c)); }
{ const c = await load({ id: "rc1", loc: "localhost", ls: "{not json" });
  check("对照：localhost 覆盖内容损坏：不抛错，按测试入口默认处理（没有测试项目 = 云端关闭）", c.url === "" && c.anonKey === "", JSON.stringify(c)); }
{ const c = await load({ id: "", loc: "localhost", ls: LS("https://aqlcunkmggzzvyavlkjg.supabase.co") });
  check("对照：正式构建 + localhost 覆盖写正式网址：不受影响（本来就是正式项目）", c.url === "https://aqlcunkmggzzvyavlkjg.supabase.co", JSON.stringify(c)); }
{ const c = await load({ id: "", loc: "evil.example", ls: JSON.stringify({ url: "https://evil.example", anonKey: "x" }) });
  check("线上域名（非 localhost）：浏览器设置里写别的网址无效，仍用写死的正式配置", c.url === "https://aqlcunkmggzzvyavlkjg.supabase.co"); }
{ const c = await load({ id: "", loc: "localhost.evil.example", ls: JSON.stringify({ url: "https://evil.example", anonKey: "x" }) });
  check("主机名只是以 localhost 开头（localhost.evil.example）：不算本机，覆盖无效", c.url === "https://aqlcunkmggzzvyavlkjg.supabase.co"); }

// ---------- B. sync：换项目的凭证、强制退出、同邮箱接管 ----------
const clock = 1_000_000;
const mkStorage = () => { const mem = new Map(); return { mem, getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }; };
const view = (st, proj) => scopedStorage(st, projectNamespace(proj, PROD));
const sessOf = (userId, email, tok = "T") => ({ accessToken: "ACCESS-" + tok, refreshToken: "REFRESH-" + tok, expiresAt: clock + 3600_000, userId, email });
function mkApi(over = {}) {
  const calls = [];
  const api = {
    calls,
    async refresh(s) { calls.push(["refresh", s.accessToken]); return { ok: false, kind: "auth" }; },
    async getProgress(s) { calls.push(["getProgress", s.accessToken]); return { ok: true, row: null }; },
    async createProgress(s, doc) { calls.push(["createProgress", s.accessToken, JSON.parse(JSON.stringify(doc))]); return { ok: true, rev: 1 }; },
    async saveProgress(s, rev, doc) { calls.push(["saveProgress", s.accessToken]); return { ok: true, rev: rev + 1 }; },
    async verifyCode(email, code) { return over.verify ? over.verify(email) : { ok: false, kind: "auth" }; },
    async signOut(s) { calls.push(["signOut", s.accessToken]); return { ok: true }; },
    ...over.api,
  };
  return api;
}
const mk = (storage, api, projectId) => createSync({ storage, api, projectId, legacyProject: PROD, now: () => clock, today: () => "2026-11-04", schedule: () => 0 });
function seedAccount(st, proj, uid, xp) {
  const s = view(st, proj); const doc = emptyDoc({ gen: 1, lineage: "L-" + uid }); doc.xp.devA = xp; doc.done = { U1L1: "2026-11-01" };
  saveAccount(s, uid, { doc, base: 2, dirty: { hearts: false, prefs: false, content: true } }, { now: clock }); setCurrentAccount(s, uid); return s;
}
const allText = (st) => [...st.mem.values()].join("\n");

{ // B1 别的项目的凭证：不交给任何网络请求
  const st = mkStorage(); const s = seedAccount(st, PROD, "u1", 40);
  s.setItem(AUTH_KEY, JSON.stringify({ session: sessOf("u1", "me@example.com", "PROD"), project: PROD }));
  const api = mkApi(); const sy = mk(st, api, TEST === PROD ? PROD : "OTHER.supabase.co");
  // 同一命名空间（OTHER 项目会带前缀），所以要在“凭证记的项目 ≠ 当前项目”的同一命名空间里构造：用 cloud-off 沿用正式键
  const sy2 = mk(st, api, "cloud-off"); sy2.restore(freshState()); await sy2.syncNow();
  check("B1 凭证记的项目与当前入口对不上：同步时不向任何接口出示这份令牌", api.calls.every((c) => !String(c[1] || "").includes("ACCESS-PROD")) && api.calls.length === 0, JSON.stringify(api.calls));
  check("B1 状态是需要重新登录，而不是静默用旧凭证", sy2.status().status === "need-login");
  const stale = st.getItem(STALE_KEY);
  check("B1 过渡标记里没有令牌（只有账号编号、邮箱、项目）", stale !== null && !/ACCESS|REFRESH|Token/i.test(stale) && Object.keys(JSON.parse(stale)).sort().join() === "email,project,userId", stale);
}
{ // B2 换项目后同邮箱登录：接管只限于“没有有效登录 + 邮箱一致”；旧项目的数据不上传
  const st = mkStorage(); const s = seedAccount(st, PROD, "u1", 40);
  s.setItem(AUTH_KEY, JSON.stringify({ session: sessOf("u1", "me@example.com", "PROD"), project: "OLD.supabase.co" }));
  const api = mkApi({ verify: (email) => ({ ok: true, session: sessOf("u2", email, "NEW") }) });
  const sy = mk(st, api, "cloud-off"); sy.restore(freshState());
  const r = await sy.verify(" ME@Example.com ", "123456", freshState());
  const created = api.calls.find((c) => c[0] === "createProgress");
  check("B2 同一邮箱（大小写 / 空格不同）在新项目登录成功", r && r.ok, JSON.stringify(r));
  check("B2 旧项目账号(u1)的 XP 没有被上传到新项目账号", !created || !created[2].xp.devA, JSON.stringify(created && created[2].xp));
  check("B2 旧项目账号的本机副本原样保留", loadAccount(view(st, PROD), "u1", { now: clock }).copy?.doc.xp.devA === 40);
  check("B2 过渡标记已清掉", st.getItem(STALE_KEY) === null);
}
{ // B3 换成别的邮箱：必须先退出
  const st = mkStorage(); const s = seedAccount(st, PROD, "u1", 40);
  s.setItem(AUTH_KEY, JSON.stringify({ session: sessOf("u1", "me@example.com", "PROD"), project: "OLD.supabase.co" }));
  const api = mkApi({ verify: (email) => ({ ok: true, session: sessOf("u3", email, "NEW3") }) });
  const sy = mk(st, api, "cloud-off"); sy.restore(freshState());
  const r = await sy.verify("someone-else@example.com", "123456", freshState());
  check("B3 邮箱不同：被拒绝(other-account)，不读也不写云端", r && !r.ok && r.kind === "other-account" && api.calls.length === 0, JSON.stringify(r) + JSON.stringify(api.calls));
}
{ // B4 登录有效时：即使邮箱相同，另一个账号编号也不能接管
  const st = mkStorage(); const s = seedAccount(st, PROD, "u1", 40);
  s.setItem(AUTH_KEY, JSON.stringify({ session: sessOf("u1", "me@example.com", "OK") }));
  s.setItem(STALE_KEY, JSON.stringify({ userId: "u1", email: "me@example.com", project: PROD }));   // 伪造一个过渡标记
  const api = mkApi({ verify: (email) => ({ ok: true, session: sessOf("u9", email, "NEW9") }) });
  const sy = mk(st, api, PROD); sy.restore(freshState());
  const r = await sy.verify("me@example.com", "123456", freshState());
  check("B4 当前登录仍有效 + 伪造过渡标记：另一个账号编号仍被拒绝", r && !r.ok && r.kind === "other-account", JSON.stringify(r));
}
{ // B5 有未上传内容时强制退出：本机副本留着，但令牌一个字不留；别的账号看不到
  const st = mkStorage(); const s = seedAccount(st, PROD, "u1", 40);
  s.setItem(AUTH_KEY, JSON.stringify({ session: sessOf("u1", "me@example.com", "LIVE") }));
  const api = mkApi({ api: { async getProgress() { return { ok: false, kind: "network", message: "offline" }; } } });
  const sy = mk(st, api, PROD); sy.restore(freshState());
  const soft = await sy.logout();
  check("B5 有未上传内容且连不上：普通退出被拦下，提示有进度没上传", soft && soft.ok === false && soft.pending === true, JSON.stringify(soft));
  check("B5 被拦下时登录状态还在（没偷偷退出）", getCurrentAccount(view(st, PROD)) === "u1" && st.getItem(AUTH_KEY) !== null);
  const hard = await sy.logout({ force: true });
  check("B5 强制退出成功", hard && hard.ok);
  check("B5 强制退出后：存储里再没有任何令牌", !/ACCESS-LIVE|REFRESH-LIVE/.test(allText(st)) && st.getItem(AUTH_KEY) === null);
  check("B5 强制退出后：当前账号已清空（回到游客状态）", getCurrentAccount(view(st, PROD)) === null);
  check("B5 强制退出后：未上传的本机副本仍在（同一账号重新登录会接着传）", loadAccount(view(st, PROD), "u1", { now: clock }).copy?.doc.xp.devA === 40);
  check("B5 别的账号(u2)读不到 u1 的副本", loadAccount(view(st, PROD), "u2", { now: clock }).copy === null || loadAccount(view(st, PROD), "u2", { now: clock }).copy === undefined);
  const fresh = mk(st, mkApi(), PROD);
  check("B5 重启后是游客状态，不会自动恢复 u1", fresh.restore(freshState()) === null && fresh.account() === null);
}
{ // B6 已同步的账号正常退出：本机副本和令牌都删掉
  const st = mkStorage(); const s = view(st, PROD);
  const doc = emptyDoc({ gen: 1, lineage: "L" }); doc.xp.devA = 5;
  saveAccount(s, "u1", { doc, base: 3, dirty: { hearts: false, prefs: false, content: false } }, { now: clock }); setCurrentAccount(s, "u1");
  s.setItem(AUTH_KEY, JSON.stringify({ session: sessOf("u1", "me@example.com", "SYNCED") }));
  const sy = mk(st, mkApi(), PROD); sy.restore(freshState());
  const r = await sy.logout();
  check("B6 无未上传内容：正常退出成功", r && r.ok);
  check("B6 副本、当前账号、令牌全部清除", loadAccount(s, "u1", { now: clock }).copy == null && getCurrentAccount(s) === null && !/SYNCED/.test(allText(st)));
}
{ // B7 测试库命名空间：登录后的令牌只落在带前缀的键里，正式版的键一个字不碰
  const st = mkStorage(); const s = seedAccount(st, PROD, "u1", 40); s.setItem(AUTH_KEY, JSON.stringify({ session: sessOf("u1", "me@example.com", "PRODTOK") }));
  const before = JSON.stringify([...st.mem.entries()].filter(([k]) => !k.startsWith("proj:")).sort());
  const api = mkApi({ verify: (email) => ({ ok: true, session: sessOf("tu1", email, "TESTTOK") }) });
  const sy = mk(st, api, TEST); sy.restore(freshState());
  const r = await sy.verify("me@example.com", "123456", freshState());
  const after = JSON.stringify([...st.mem.entries()].filter(([k]) => !k.startsWith("proj:") && k !== "suipian.device" && k !== "suipian.guestId").sort());
  const beforeNoId = JSON.stringify(JSON.parse(before).filter(([k]) => k !== "suipian.device" && k !== "suipian.guestId"));
  check("B7 测试库登录成功", r && r.ok, JSON.stringify(r));
  check("B7 正式版的键（账号副本、当前账号、登录凭证）一个字没变", after === beforeNoId);
  check("B7 测试库的令牌只出现在带 proj: 前缀的键里", [...st.mem.entries()].every(([k, v]) => !/TESTTOK/.test(v) || k.startsWith(`proj:${TEST}:`)));
  check("B7 测试库的请求没有带正式版的令牌", api.calls.every((c) => !String(c[1] || "").includes("PRODTOK")));
}

const failed = results.filter((r) => !r).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
