// 反向验证：把“同步任务的账号会话代次”保护一处一处故意改坏，tests/sync-stale-generation.test.mjs 必须变红。
// 做法：复制 src/ 和专项测试到临时目录，每次只改一处，跑同一个测试；不改工作区文件。
// 运行：node tests/sync-stale-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEST = join("tests", "sync-stale-generation.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const W = mkdtempSync(join(tmpdir(), "sp-syncstale-mut-"));
const SRC = join(W, "src");
try {
  mkdirSync(join(W, "tests"), { recursive: true });
  cpSync(join(ROOT, TEST), join(W, TEST));
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));
  const reset = () => { rmSync(SRC, { recursive: true, force: true }); cpSync(join(ROOT, "src"), SRC, { recursive: true }); };
  const run = () => spawnSync(process.execPath, [join(W, TEST)], { cwd: W, encoding: "utf8", timeout: 180000 });
  reset();
  const base = run();
  check("未改源码的对照：代次专项全绿", base.status === 0, (base.stdout + base.stderr).split("\n").slice(-3).join(" | "));

  const MUTS = [
    ["退出 / 登录时代次不前进（finishLocalLogout）", "bumpAcct(); session = null; userId = null; email = \"\"; baseline = null; pending = false; waiting = null; lastSyncedAt = null; // 退出后不再显示上一个账号的“最近确认同步”\n    setStatus(null);\n  }", "session = null; userId = null; email = \"\"; baseline = null; pending = false; waiting = null; lastSyncedAt = null;\n    setStatus(null);\n  }"],
    ["读取返回后不核对代次", "const remote = await api.getProgress(session);\n      if (dead()) return staleResult();", "const remote = await api.getProgress(session);"],
    ["保存返回后不核对代次", "const s = await api.saveProgress(session, remote.row.rev, finalDoc);\n          if (dead()) return staleResult();", "const s = await api.saveProgress(session, remote.row.rev, finalDoc);"],
    ["创建返回后不核对代次", "const c = await api.createProgress(session, copy.doc);\n        if (dead()) return staleResult();", "const c = await api.createProgress(session, copy.doc);"],
    ["刷新令牌返回后不核对代次", "const r = await api.refresh(session);\n    if (gen !== acctGen) return staleResult();", "const r = await api.refresh(session);"],
    ["刷新后 syncOnce 不核对代次", "const t = await ensureToken(gen);\n    if (dead()) return staleResult();", "const t = await ensureToken(gen);"],
    ["旧任务收尾无条件清 running", "finally { if (running === mine) running = null; }", "finally { running = null; }"],
    ["前进代次时不放掉旧任务占着的 running", "function bumpAcct() { acctGen++; running = null;", "function bumpAcct() { acctGen++;"],
    ["自动同步计时器不带代次", "timer = schedule(() => { if (g !== acctGen) return; timer = null; syncNow(); }, ms);", "timer = schedule(() => { timer = null; syncNow(); }, ms);"],
    ["退避重试计时器不带代次", "retryTimer = schedule(() => { if (g !== acctGen) return; retryTimer = null; syncNow(); }, delay);", "retryTimer = schedule(() => { retryTimer = null; syncNow(); }, delay);"],
  ];
  for (const [name, from, to] of MUTS) {
    reset();
    const p = join(SRC, "sync.js");
    const text = readFileSync(p, "utf8");
    if (!text.includes(from)) { check(`变异“${name}”：要改的源码片段存在`, false, "片段没找到：" + from.slice(0, 60)); continue; }
    writeFileSync(p, text.replace(from, to));
    const r = run();
    check(`变异“${name}”：代次专项变红（失败或挂住都算红，exit=${r.status}）`, r.status !== 0 && r.status !== null, `exit=${r.status}`);
  }
} finally { rmSync(W, { recursive: true, force: true }); }
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
