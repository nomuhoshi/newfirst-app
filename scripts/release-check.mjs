// 发布后 / 发布前对“线上实际产物”的只读核对（清单 R8、R9 冒烟的自动化部分）。
// 用法：node scripts/release-check.mjs [网址，默认 https://nomuhoshi.github.io/newfirst-app/]
// 只发 GET 请求；不登录、不写入、不碰任何云端。任何一项不满足就以非零退出。
const BASE = (process.argv[2] || "https://nomuhoshi.github.io/newfirst-app/").replace(/\/?$/, "/");
let fail = 0;
const check = (name, ok, detail = "") => { if (!ok) fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : "  — " + detail}`); };
const get = async (p) => { const r = await fetch(new URL(p, BASE), { redirect: "follow", headers: { "cache-control": "no-cache" } }); return { status: r.status, text: await r.text(), type: r.headers.get("content-type") || "" }; };

const idx = await get("");
check("首页 200 且是 HTML", idx.status === 200 && /html/.test(idx.type), `${idx.status} ${idx.type}`);
const refs = [...idx.text.matchAll(/(?:src|href)="(\.\/[^"#?]+)"/g)].map((m) => m[1]).filter((x) => !x.endsWith("/"));
check("首页引用了脚本、样式、图标和 manifest", refs.some((r) => r.endsWith(".js")) && refs.some((r) => r.endsWith(".css")) && refs.some((r) => r.includes("manifest")), refs.join(","));
const bodies = {};
for (const r of refs) { const x = await get(r); bodies[r] = x.text; check(`资源 200：${r}`, x.status === 200, String(x.status)); }
const csp = (idx.text.match(/http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/i) || [])[1] || "";
check("首页带内容安全策略（CSP）", /default-src/.test(csp));
console.log("   connect-src：", (csp.match(/connect-src[^;]*/) || ["（无）"])[0]);
check("CSP 不含测试域 fake.supabase.test", !csp.includes("fake.supabase.test"));
const js = Object.entries(bodies).filter(([k]) => k.endsWith(".js")).map(([, v]) => v).join("\n");
check("脚本里不含测试域 fake.supabase.test", !js.includes("fake.supabase.test"));
check("课程包含第 1–8 单元的关卡（U1L1 … U8L6）", ["U1L1", "U5L7", "U6L9", "U7L1", "U7L6", "U8L1", "U8L6"].every((id) => js.includes(`"${id}"`) || js.includes(id)));
for (const p of ["privacy.html", "manifest.webmanifest", "sw.js", "robots.txt"]) { const x = await get(p); check(`${p} 200`, x.status === 200, String(x.status)); }
const man = await get("manifest.webmanifest"); let mj = null; try { mj = JSON.parse(man.text); } catch {}
check("manifest 可解析且有名称和图标", !!mj && !!(mj.name || mj.short_name) && Array.isArray(mj.icons) && mj.icons.length > 0);
for (const p of ["access-test.html", "lab.html"]) { const x = await get(p); check(`测试页不在线上：${p} 为 404`, x.status === 404, String(x.status)); }
console.log(fail ? `\n失败 ${fail} 项` : "\n全部通过");
process.exit(fail ? 1 : 0);
