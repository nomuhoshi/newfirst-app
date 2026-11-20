// 反向验证：把“退出去重 / 旧退出结果隔离”的保护一处一处故意改坏，tests/logout-dedupe-stale.test.mjs 必须变红。
// 做法：复制 src/ 和专项测试到临时目录，每次只改一处，跑同一个测试；不改工作区文件。
// 运行：node tests/logout-dedupe-stale-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEST = join("tests", "logout-dedupe-stale.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const W = mkdtempSync(join(tmpdir(), "sp-logout-mut-"));
const SRC = join(W, "src");
try {
  mkdirSync(join(W, "tests"), { recursive: true });
  cpSync(join(ROOT, TEST), join(W, TEST));
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));
  const reset = () => { rmSync(SRC, { recursive: true, force: true }); cpSync(join(ROOT, "src"), SRC, { recursive: true }); };
  const run = () => spawnSync(process.execPath, [join(W, TEST)], { cwd: W, encoding: "utf8", timeout: 180000 });
  reset();
  const base = run();
  check("未改源码的对照：退出去重专项全绿", base.status === 0, (base.stdout + base.stderr).split("\n").slice(-3).join(" | "));

  // 已核实、故意不单独做变异的冗余防线：revokeCloudSession 里“第二次 signOut 之后”的 isCurrent 检查（logout 在 revoke 返回后会再用 owns() 判断一次，结果相同）；
  const MUTS = [
    ["sync.js", "不合并重复退出（连点就发多次云端撤销）", "if (userId && logoutOp && logoutOp.uid === userId &&", "if (false && userId && logoutOp && logoutOp.uid === userId &&"],
    ["sync.js", "合并时不看会话代次（同号重新登录后，新会话的退出被合并进旧退出一起作废）", "logoutOp.uid === userId && logoutOp.gen === acctGen &&", "logoutOp.uid === userId &&"],
    ["sync.js", "所有权只看登记、不比较会话代次（删除账号取代在途退出后，旧退出仍当自己是所有者）", "const owns = () => logoutOp === op && acctGen === op.gen;", "const owns = () => logoutOp === op;"],
    ["sync.js", "旧的令牌刷新迟到返回时不核对会话代次（旧令牌写进同号重新登录的新会话）", "    if (gen !== acctGen) return staleResult(); // 刷新期间退出 / 换了账号：旧的刷新结果不能写进新会话，也不能写存储里的凭证\n    // 刷新返回后、writeAuth() 写回凭证之前", "    // 刷新返回后、writeAuth() 写回凭证之前"],
    ["sync.js", "强制退出在跑时，后来的退出不合并", "(!dropping || (logoutOp.dropping && (!local || logoutOp.local)))) return logoutOp.promise;", "(!dropping)) return logoutOp.promise;"],
    ["sync.js", "强制本机退出不能取代在途的联网强制退出（被合并过去，要等云端撤销）", "(!dropping || (logoutOp.dropping && (!local || logoutOp.local)))) return logoutOp.promise;", "(!dropping || logoutOp.dropping)) return logoutOp.promise;"],
    ["sync.js", "旧退出永远认为自己还是所有者（没有任何旧任务保护）", "const owns = () => logoutOp === op && acctGen === op.gen;", "const owns = () => true;"],
    ["sync.js", "撤销返回后不复查所有权（旧撤销失败时回滚旧账号 / 成功时清新凭证）", "    if (!owns()) return supersededLogout(); // 旧退出被取代：撤销成功 / 失败都不再回滚、不清凭证、不动状态\n", ""],
    ["sync.js", "强制退出的撤销返回后不复查所有权（旧强制退出清掉新会话）", "      if (!owns()) return supersededLogout(); // 撤销等待期间被取代（又强制退出过 / 重新登录了）：不再收尾，不碰新会话\n", ""],
    ["sync.js", "等上传进度返回后不复查所有权", "      const r = await syncNow();\n      if (!owns()) return supersededLogout();\n", "      const r = await syncNow();\n"],
    ["sync.js", "等刷新令牌返回后不复查所有权", "      const t = await ensureToken();\n      if (!owns()) return supersededLogout();\n", "      const t = await ensureToken();\n"],
    ["sync.js", "撤销过程中被取代后仍去刷新（第一次撤销返回后不复查）", "      let so = await api.signOut(sess, \"local\");\n      if (isCurrent && !isCurrent()) return { ok: false, kind: \"stale\", superseded: true, message: \"\" }; // 这次退出已被取代（强制本机退出 / 删除账号 / 又登录了）：后面的刷新、写凭证都不做，免得改到新会话\n", "      let so = await api.signOut(sess, \"local\");\n"],
    ["sync.js", "撤销过程中刷新返回后不复查（旧令牌写进新会话）", "      if (isCurrent && !isCurrent()) return { ok: false, kind: \"stale\", superseded: true, message: \"\" }; // 同上：刷新返回时已被取代，不能把旧账号轮换出来的令牌写进新会话 / 存储\n", ""],
    ["sync.js", "旧退出收尾时把“正在退出”标志清掉（会清掉后来新退出设的标志）", "finally { if (owns()) { loggingOut = false; selfLogoutCleaning = false; } }", "finally { loggingOut = false; selfLogoutCleaning = false; }"],
    ["sync.js", "代次前进时不清“正在退出”标志（被取代后同步一直被拒）", "function bumpAcct() { acctGen++; loggingOut = false;", "function bumpAcct() { acctGen++;"],
    ["sync.js", "退出结束后不释放登记（失败后再退出被合并到旧结果）", "promise.finally(() => { if (logoutOp === op) logoutOp = null; }).catch(() => {});", ""],
    ["account-ui.js", "界面退出 / 切换账号没有共用的处理中锁", "const withLogoutLock = async (fn) => { if (logoutBusy) return;", "const withLogoutLock = async (fn) => {"],
    ["account-ui.js", "界面拿到“已被取代”的结果还照样走一次已退出", "      if (r.stale) return; // 这次退出已被别的操作取代", "      if (false) return; // 这次退出已被别的操作取代"],
  ];
  for (const [file, name, from, to] of MUTS.filter((m) => m[0] === "sync.js")) {
    reset();
    const p = join(SRC, file);
    const text = readFileSync(p, "utf8");
    if (!text.includes(from)) { check(`变异“${name}”：要改的源码片段存在`, false, "片段没找到：" + from.slice(0, 60)); continue; }
    writeFileSync(p, text.replace(from, to));
    const r = run();
    const fails = (r.stdout.match(/^❌/gm) || []).length;
    check(`变异“${name}”：退出去重专项变红（失败或挂住都算红，exit=${r.status}，红 ${fails} 项）`, r.status !== 0 && r.status !== null, `exit=${r.status}`);
  }
} finally { rmSync(W, { recursive: true, force: true }); }
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
