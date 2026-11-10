// 测试基础设施自检（纯 Node，几秒）：防止 npm test 再次“卡死”或被旧进程串扰。
//   A 进程内静态服务器：随机端口、能托管文件、拦路径穿越、close() 后端口真的释放、两个同时跑互不冲突；
//   B 不再有测试用 `npx vite preview` 起服务器（它的 kill() 杀不掉里面真正的 vite，进程和端口会一直残留）；
//   C 运行器 scripts/run-tests.mjs：全过 → 0；失败 → 立即停；超时 → 杀掉整个进程组（含孙进程）并点名“卡住”；KEEP_GOING 跑完汇总。
// 运行：node tests/test-infra.test.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import net from "node:net";
import { startDistServer } from "./helpers/dist-server.mjs";
import { fileURLToPath } from "node:url";

const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + String(d).slice(0, 300) : ""}`); };
const portOpen = (port) => new Promise((ok) => { const s = net.connect(port, "127.0.0.1"); s.once("connect", () => { s.destroy(); ok(true); }); s.once("error", () => ok(false)); });

{ // A
  const dir = mkdtempSync(join(tmpdir(), "dist-"));
  writeFileSync(join(dir, "index.html"), "<h1>hello</h1>"); writeFileSync(join(dir, "x.json"), "{}"); writeFileSync(join(dir, "w.wasm"), "\0asm");
  const a = await startDistServer({ dist: dir }), b = await startDistServer({ dist: dir });
  check("A 进程内静态服务器：两个同时启动，端口不同（不会撞车）", a.port !== b.port && a.port > 0 && b.port > 0, `${a.port} ${b.port}`);
  const r = await fetch(a.base), j = await fetch(a.base + "x.json"), w = await fetch(a.base + "w.wasm");
  check("A 根路径给 index.html，json / wasm 的类型正确", (await r.text()).includes("hello") && /text\/html/.test(r.headers.get("content-type")) && /application\/json/.test(j.headers.get("content-type")) && /application\/wasm/.test(w.headers.get("content-type")));
  check("A 路径穿越（/../package.json）和不存在的文件都是 404", (await fetch(a.base + "..%2Fpackage.json")).status === 404 && (await fetch(a.base + "nope.js")).status === 404);
  check("A 启动后端口立刻可连（返回时就是就绪的，不靠固定等待）", await portOpen(a.port));
  await a.close(); await b.close();
  check("A close() 之后端口真的释放（旧写法 server.kill() 做不到）", !(await portOpen(a.port)) && !(await portOpen(b.port)));
}
{ // B
  const bad = readdirSync(fileURLToPath(new URL(".", import.meta.url))).filter((f) => f.endsWith(".mjs") && f !== "test-infra.test.mjs").filter((f) => /["']vite["']\s*,\s*["']preview["']/.test(readFileSync(new URL(f, import.meta.url), "utf8")));
  check("B 没有测试再用 vite preview 起服务器", bad.length === 0, bad.join(", "));
}
const run = (chain, env = {}) => { const t0 = Date.now(); const r = spawnSync("node", ["scripts/run-tests.mjs"], { cwd: fileURLToPath(new URL("..", import.meta.url)), env: { ...process.env, TEST_CHAIN_CMD: chain, ...env }, encoding: "utf8", timeout: 60000 }); return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), secs: (Date.now() - t0) / 1000 }; };
const alive = (marker) => spawnSync("pgrep", ["-f", marker], { encoding: "utf8" }).stdout.trim() !== "";
{ // C
  let r = run(`node -e "console.log('ONE')" && node -e "console.log('TWO')"`);
  check("C 运行器：全部通过 → 退出码 0，汇总里每条都有耗时", r.code === 0 && /ONE/.test(r.out) && /TWO/.test(r.out) && (r.out.match(/✅ rc=0/g) || []).length === 2, r.out);
  r = run(`node -e "process.exit(3)" && node -e "console.log('SHOULD_NOT_RUN')"`);
  check("C 运行器：第一条失败 → 退出码 1，后面的不跑，汇总点名失败的命令", r.code === 1 && !/SHOULD_NOT_RUN/.test(r.out) && /失败：node -e "process.exit\(3\)"/.test(r.out) && /剩余 1 条/.test(r.out), r.out);
  r = run(`node -e "process.exit(3)" && node -e "console.log('AFTER_FAIL')"`, { KEEP_GOING: "1" });
  check("C 运行器：KEEP_GOING=1 → 失败后继续跑完，最后仍然退出码 1", r.code === 1 && /AFTER_FAIL/.test(r.out), r.out);
  const marker = "HANGMARK" + process.pid;
  r = run(`node -e "console.log('BEFORE')" && node -e "require('child_process').spawn('sleep',['1000','${marker}'],{stdio:'ignore'}); setTimeout(()=>{},1e9)" && node -e "console.log('SHOULD_NOT_RUN')"`, { TEST_STEP_TIMEOUT: "2" });
  check("C 运行器：某条命令卡住 → 超时后几秒内结束，退出码 1，点名“卡住：…”，后面的不跑", r.code === 1 && r.secs < 25 && /超时（2 秒）/.test(r.out) && /卡住：node -e/.test(r.out) && !/SHOULD_NOT_RUN/.test(r.out) && /BEFORE/.test(r.out), `${r.secs}s ${r.out}`);
  await new Promise((ok) => setTimeout(ok, 500));
  check("C 运行器：超时会杀整个进程组，卡住的命令派生出来的孙进程也不残留", !alive(marker), "仍有进程 " + marker);
  if (alive(marker)) spawnSync("pkill", ["-f", marker]);
}
const pass = results.filter(Boolean).length;
console.log(`\n共 ${results.length} 项，失败 ${results.length - pass} 项`);
process.exit(pass === results.length ? 0 : 1);
