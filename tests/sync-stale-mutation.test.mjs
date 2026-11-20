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

  // 已核实、故意不做变异的冗余防线：拿到锁后的 gen 检查（syncOnce 里 dead() 会立刻拦下，不发请求不写本机）、runPendingImport 返回后的 dead() 检查（写入函数每次 await 后已经检查，stale 结果会原样返回）。
  const MUTS = [
    ["读取返回后不核对代次", "const remote = await api.getProgress(session);\n      if (dead()) return staleResult();", "const remote = await api.getProgress(session);"],
    ["保存返回后不核对代次", "const s = await api.saveProgress(session, remote.row.rev, finalDoc);\n          if (dead()) return staleResult();", "const s = await api.saveProgress(session, remote.row.rev, finalDoc);"],
    ["创建返回后不核对代次", "const c = await api.createProgress(session, copy.doc);\n        if (dead()) return staleResult();", "const c = await api.createProgress(session, copy.doc);"],
    ["刷新令牌返回后不核对代次", "const r = await api.refresh(session);\n    if (gen !== acctGen) return staleResult();", "const r = await api.refresh(session);"],
    ["刷新后 syncOnce 不核对代次", "const t = await ensureToken(gen);\n    if (dead()) return staleResult();", "const t = await ensureToken(gen);"],
    ["旧任务收尾无条件清 running", "finally { if (running === mine) running = null; }", "finally { running = null; }"],
    ["前进代次时不放掉旧任务占着的 running", "abandonWaiters.clear(); running = null;", "abandonWaiters.clear();"],
    ["强制退出：本机清完后不立刻作废旧同步", "ownBump(); session = null;\n      if (forceLocal)", "session = null;\n      if (forceLocal)"],
    ["普通退出：本机清完后不立刻作废旧同步", "ownBump(); // 同上：本机清理已成功", "// 同上：本机清理已成功"],
    ["代次前进时不放掉旧任务占着的本机写回锁", "for (const f of [...abandonWaiters]) f(); ", ""],
    ["游客导入（保留云端）：读最新云端后不核对代次", "let latest = await readLatestCloud(sess);\n    if (dead()) return staleImport();", "let latest = await readLatestCloud(sess);"],
    ["游客导入（保留云端）：读回后不核对代次", "const rb = await api.getProgress(sess);\n    if (dead()) return staleImport();", "const rb = await api.getProgress(sess);"],
    ["游客导入（安全合并）：读最新云端后不核对代次", "let current = await readLatestCloud(sess);\n    if (dead()) return staleImport();", "let current = await readLatestCloud(sess);"],
    ["强制退出的撤销过程仍把轮换凭证写回登录态（不用局部凭证）", "if (!detached) { session = cur; email = session.email || email; writeAuth(); }", "{ session = cur; email = session.email || email; writeAuth(); }"],
    ["锁请求被拒绝时不核对代次（旧任务改 pending / localRetryUnknown）", "if (gen !== acctGen) return staleResult(); // 锁请求迟到拒绝", "// 锁请求迟到拒绝"],
    ["finish（登录选择）不带代次：导入结果迟到照样完成登录", "result = await runPendingImport(record, ctx.session, { dead });", "result = await runPendingImport(record, ctx.session);"],
    ["还没登录时退出不作废在途的登录选择", "if (!userId) { bumpAcct(); waiting = null; return { ok: true }; }", "if (!userId) return { ok: true };"],
    ["普通退出等撤销期间不拦新同步", "if (loggingOut) return Promise.resolve(staleResult());", ""],
    ["本机写回锁的“持锁”标记不再设置（有 window 时自动同步被误判成没持锁）", "          retryLockHeld = true;\n", ""],
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
