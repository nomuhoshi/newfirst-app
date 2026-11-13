// 测试基础设施自检（纯 Node，几秒）：防止 npm test 再次“卡死”或被旧进程串扰。
//   A 进程内静态服务器：随机端口、能托管文件、拦路径穿越、close() 后端口真的释放、两个同时跑互不冲突；
//   B 不再有测试用 `npx vite preview` 起服务器（它的 kill() 杀不掉里面真正的 vite，进程和端口会一直残留）；
//   C 运行器 scripts/run-tests.mjs：全过 → 0；失败 → 立即停；超时 → 杀掉整个进程组（含孙进程）并点名“卡住”；KEEP_GOING 跑完汇总。
//   D mobile / e2e 外层运行器（tests/webkit/run.mjs、tests/e2e/run.mjs，执行器 scripts/script-runner.mjs），用合成脚本：
//     全过 → 0；有失败 → 非 0 且后面的脚本照跑；脚本卡住并派生孙进程 → 超时(124)、杀净、后面的脚本照跑；启动失败 / 被信号杀 / 退出码 2 → 环境失败，绝不误报通过；
//     脚本正常退出但留下后台进程 → 也被清掉；两个运行器的脚本列表里每个文件都存在。
// 运行：node tests/test-infra.test.mjs
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
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
  r = run(`node -e "console.log('BEFORE')" && node -e "require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},1e9)','${marker}'],{stdio:'ignore'}); setTimeout(()=>{},1e9)" && node -e "console.log('SHOULD_NOT_RUN')"`, { TEST_STEP_TIMEOUT: "2" });
  check("C 运行器：某条命令卡住 → 超时后几秒内结束，退出码 1，点名“卡住：…”，后面的不跑", r.code === 1 && r.secs < 25 && /超时（2 秒）/.test(r.out) && /卡住：node -e/.test(r.out) && !/SHOULD_NOT_RUN/.test(r.out) && /BEFORE/.test(r.out), `${r.secs}s ${r.out}`);
  await new Promise((ok) => setTimeout(ok, 500));
  check("C 运行器：超时会杀整个进程组，卡住的命令派生出来的孙进程也不残留", !alive(marker), "仍有进程 " + marker);
  if (alive(marker)) spawnSync("pkill", ["-f", marker]);
}
{ // D
  const ROOT = fileURLToPath(new URL("..", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "runner-"));
  const mk = (name, body) => { const f = join(dir, name); writeFileSync(f, body); return f; };
  const ok1 = mk("ok1.mjs", `console.log("OK1 engine=" + process.env.MOBILE_BROWSER + " judge=" + process.env.JUDGE_BROWSERS)`), ok2 = mk("ok2.mjs", `console.log("OK2")`);
  const bad = mk("bad.mjs", `console.log("BAD_RAN"); process.exit(3)`), env2 = mk("env2.mjs", `process.exit(2)`), sig = mk("sig.mjs", `process.kill(process.pid, "SIGKILL")`);
  const after = mk("after.mjs", `console.log("AFTER_RAN")`);
  const runner = (which, engine, scripts, env = {}) => { const t0 = Date.now(); const r = spawnSync("node", [which, engine], { cwd: ROOT, env: { ...process.env, TEST_RUNNER_SCRIPTS: JSON.stringify(scripts), ...env }, encoding: "utf8", timeout: 90000 }); return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), secs: (Date.now() - t0) / 1000 }; };
  const RUNNERS = [["tests/webkit/run.mjs", "webkit"], ["tests/e2e/run.mjs", "chromium"]];
  for (const [which, eng] of RUNNERS) {
    const tag = `${which} (${eng})`;
    let r = runner(which, eng, [ok1, ok2]);
    check(`D ${tag}：全部成功 → 退出码 0，逐脚本汇总 2 行通过，引擎参数照旧传给脚本`, r.code === 0 && /共 2 个脚本：通过 2，失败 0，超时 0，环境失败 0/.test(r.out) && (r.out.match(/✅ 通过/g) || []).length === 2 && new RegExp(`OK1 engine=${eng} judge=${eng}`).test(r.out), r.out);
    r = runner(which, eng, [ok1, bad, after]);
    check(`D ${tag}：中间一个失败 → 退出码非 0（=3），汇总点名失败脚本，前后的脚本照跑`, r.code === 3 && /BAD_RAN/.test(r.out) && /AFTER_RAN/.test(r.out) && /OK1/.test(r.out) && /❌ 失败\s+rc=3\s.*bad\.mjs/.test(r.out) && /通过 2，失败 1，超时 0，环境失败 0/.test(r.out) && new RegExp(`== ${eng}: 失败`).test(r.out), r.out);
    r = runner(which, eng, [env2, sig, ok2]);
    check(`D ${tag}：退出码 2 / 被信号杀掉 → 都记“环境失败”，退出码非 0，不误报通过`, r.code === 2 && (r.out.match(/⚠️ 环境失败/g) || []).length === 2 && /通过 1，失败 0，超时 0，环境失败 2/.test(r.out) && new RegExp(`== ${eng}: 环境失败`).test(r.out), r.out);
  }
  // 存活探测：kill(pid,0) 成功且不是僵尸（Z）。被 SIGKILL 的孤儿进程在容器里可能短暂是僵尸、等 init 回收，这不算“还活着”。
  const pidAlive = (pid) => { try { process.kill(pid, 0); } catch { return false; } try { const st = readFileSync(`/proc/${pid}/stat`, "utf8"); return st.slice(st.lastIndexOf(")") + 2, st.lastIndexOf(")") + 3) !== "Z"; } catch { return true; } };
  const waitFor = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await new Promise((ok) => setTimeout(ok, 50)); } return null; };
  const readPid = (f) => { try { const n = Number(readFileSync(f, "utf8").trim()); return n > 0 ? n : null; } catch { return null; } };
  // 孙进程：自己启动后把自己的 PID 写进就绪文件，再常驻；这样“清理前它确实活着”有证据（PID + 存活探测），清理后再确认它消失
  const grandchild = (pidFile, marker) => `import { spawn } from "node:child_process"; spawn(process.execPath, ["-e", "require('fs').writeFileSync(process.argv[1], String(process.pid)); setTimeout(()=>{},1e9)", ${JSON.stringify(pidFile)}, "${marker}"], { stdio: "ignore" })`;
  { // 卡住 + 派生孙进程
    const marker = "RUNHANG" + process.pid, pidFile = join(dir, "hang.pid");
    const hang = mk("hang.mjs", `${grandchild(pidFile, marker)}; console.log("HANG_START"); setTimeout(() => {}, 1e9);`);
    const t0 = Date.now();
    const child = spawn("node", ["tests/webkit/run.mjs", "webkit"], { cwd: ROOT, env: { ...process.env, TEST_RUNNER_SCRIPTS: JSON.stringify([ok1, hang, after]), TEST_STEP_TIMEOUT: "3" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
    const exited = new Promise((ok) => child.on("exit", (code) => ok(code)));
    const pid = await waitFor(() => readPid(pidFile));
    const aliveBefore = !!pid && pidAlive(pid) && alive(marker) && (Date.now() - t0) < 3000 + 500 && /HANG_START/.test(out); // 超时点（3 秒）到来之前，孙进程已就绪且活着
    const code = await exited;
    await new Promise((ok) => setTimeout(ok, 300));
    check("D 脚本卡住并派生孙进程 → 3 秒上限到点杀掉，退出码 124，汇总点名“超时”，后面的脚本照跑", code === 124 && (Date.now() - t0) / 1000 < 40 && /超时（3 秒）：hang\.mjs/.test(out) && /⏱ 超时\s+rc=124\s.*hang\.mjs/.test(out) && /AFTER_RAN/.test(out) && /通过 2，失败 0，超时 1，环境失败 0/.test(out) && /== webkit: 超时/.test(out), `${code} ${out}`);
    check(`D 清理前证据：超时点到来之前孙进程已就绪（PID ${pid}）且确实存活`, aliveBefore, `pid=${pid} hasMarker=${alive(marker)}`);
    check(`D 清理后：同一个孙进程（PID ${pid}）已被杀掉，不残留`, !!pid && !pidAlive(pid) && !alive(marker), `pid=${pid}`);
    if (pid && pidAlive(pid)) try { process.kill(pid, "SIGKILL"); } catch { /* 已退出 */ }
  }
  { // 正常退出但留下后台进程：脚本等孙进程就绪（PID 写入）后才退出，保证“清理前它活着”
    const marker = "RUNLEFT" + process.pid, pidFile = join(dir, "left.pid");
    const leave = mk("leave.mjs", `${grandchild(pidFile, marker)}.unref(); import { existsSync, readFileSync } from "node:fs"; const t0 = Date.now(); while (!existsSync(${JSON.stringify(pidFile)}) && Date.now() - t0 < 10000) await new Promise((r) => setTimeout(r, 20)); console.log("LEFT_OK pid=" + readFileSync(${JSON.stringify(pidFile)}, "utf8"));`);
    const r = runner("tests/e2e/run.mjs", "webkit", [leave]);
    const pid = readPid(pidFile);
    const said = Number((r.out.match(/LEFT_OK pid=(\d+)/) || [])[1]);
    await new Promise((ok) => setTimeout(ok, 300));
    check(`D 清理前证据：脚本退出前孙进程已写出自己的 PID（${said}），说明它确实活着`, r.code === 0 && !!said && said === pid, `code=${r.code} said=${said} pid=${pid} ${r.out}`);
    check("D 脚本正常退出（退出码 0）但留下后台进程 → 运行器照样清掉这个 PID，不残留", !!pid && !pidAlive(pid) && !alive(marker), `pid=${pid}`);
    if (pid && pidAlive(pid)) try { process.kill(pid, "SIGKILL"); } catch { /* 已退出 */ }
  }
  { // 启动失败（解释器不存在）：直接调执行器
    const { runScript } = await import("../scripts/script-runner.mjs");
    const row = await runScript({ file: ok2, engine: "webkit" }, { execPath: "/nonexistent/node-binary", limitMs: 5000 });
    check("D 脚本启动失败（解释器不存在）→ 记“环境失败”，退出码 2，不是通过", row.kind === "env" && row.code === 2, JSON.stringify(row));
  }
  { // 脚本列表完整：两个运行器引用的测试文件都存在，且没有重复
    for (const f of ["tests/webkit/run.mjs", "tests/e2e/run.mjs"]) {
      const names = [...readFileSync(join(ROOT, f), "utf8").matchAll(/["'](\.{1,2}\/[\w./-]+\.test\.mjs)["']/g)].map((m) => m[1]);
      const missing = names.filter((n) => !existsSync(join(ROOT, f, "..", n)));
      check(`D ${f} 引用 ${names.length} 个测试脚本，全部存在、没有重复`, names.length > 0 && missing.length === 0 && new Set(names).size === names.length, missing.join(", "));
    }
  }
}
const pass = results.filter(Boolean).length;
console.log(`\n共 ${results.length} 项，失败 ${results.length - pass} 项`);
process.exit(pass === results.length ? 0 : 1);
