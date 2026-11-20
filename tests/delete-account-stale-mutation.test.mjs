// 反向验证：把“删除账号迟到隔离”的保护一处一处故意改坏，tests/delete-account-stale.test.mjs 必须变红。
// 做法：复制 src/ 和专项测试到临时目录，每次只改一处，跑同一个测试；不改工作区文件。
// 运行：node tests/delete-account-stale-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEST = join("tests", "delete-account-stale.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const W = mkdtempSync(join(tmpdir(), "sp-delete-mut-"));
const SRC = join(W, "src");
try {
  mkdirSync(join(W, "tests"), { recursive: true });
  cpSync(join(ROOT, TEST), join(W, TEST));
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));
  const reset = () => { rmSync(SRC, { recursive: true, force: true }); cpSync(join(ROOT, "src"), SRC, { recursive: true }); };
  const run = () => spawnSync(process.execPath, [join(W, TEST)], { cwd: W, encoding: "utf8", timeout: 180000 });
  reset();
  const base = run();
  check("未改源码的对照：删除账号迟到隔离专项全绿", base.status === 0, (base.stdout + base.stderr).split("\n").slice(-3).join(" | "));

  // 已核实、故意不单独做变异的等价改动：把 api.deleteAccount(sess) 改成 api.deleteAccount(session)——sess 是发请求前一行才读的，两者同值，行为上不可区分；
  // “用 uid 而不是 userId 清本机”被 ours() 提前拦住，同样不可区分。
  // “合并时不看账号（只看会话代次）”同样不可区分：换账号一定会让会话代次前进，账号比较是第二道冗余防线。
  // 删除前的“等刷新令牌”有两道互相冗余的防线（ensureToken 的代次检查 + 删除自己的 ours()），单拆任何一道行为不变，所以只做同时拆掉两道的组合变异。
  const MUTS = [
    ["sync.js", "请求返回后不复查账号 / 会话（迟到的成功清掉新账号的副本和凭证）", "    if (!ours()) return staleDelete(deleteOutcome(r));", "    if (false) return staleDelete(deleteOutcome(r));"],
    ["sync.js", "等令牌刷新返回后既不复查、刷新也不核对会话代次（刷新期间已换账号，仍替新账号发删除请求）", ["    if (!ours()) return staleDelete(false, {", "    if (gen !== acctGen) return staleResult(); // 刷新期间退出 / 换了账号"], ["    if (false) return staleDelete(false, {", "    if (false) return staleResult(); // 刷新期间退出 / 换了账号"]],
    ["sync.js", "同一会话重复点删除不合并（发出多次删除请求）", "if (deleteOp && deleteOp.gen === acctGen && deleteOp.uid === userId) return deleteOp.promise;", "if (false && deleteOp && deleteOp.gen === acctGen && deleteOp.uid === userId) return deleteOp.promise;"],
    ["sync.js", "合并时不看会话代次（同号重新登录后的新删除被并进旧删除）", "deleteOp.gen === acctGen && deleteOp.uid === userId) return deleteOp.promise;", "deleteOp.uid === userId) return deleteOp.promise;"],
    ["sync.js", "删除结束后不释放登记（失败后重试被并进旧失败结果）", "op.promise.finally(() => { if (deleteOp === op) deleteOp = null; }).catch(() => {});", ""],
    ["sync.js", "响应丢失 / 超时也当作“云端明确没删”（把结果未知误报成删除失败）", "(r.ok === true ? true : r.kind === \"network\" ? null : false)", "(r.ok === true ? true : false)"],
    ["sync.js", "结果未知时仍说“删除没有完成”（提示文案和结果不符）", "null: \"无法确认旧账号是否已删除；当前登录和本机数据未改动。\" };", "null: \"删除没有完成，云端报错了；这台设备在删除过程中已退出或换了账号，本机没有改动。\" };"],
    ["sync.js", "迟到结果不再标记为“已被取代”（界面会当成普通结果走回调）", "kind: \"stale\", stale: true, superseded: true, retryable: false, cloudDeleted,", "kind: \"stale\", retryable: false, cloudDeleted,"],
  ];
  for (const [file, name, from, to] of MUTS.filter((m) => m[0] === "sync.js")) {
    reset();
    const p = join(SRC, file);
    let text = readFileSync(p, "utf8");
    const froms = [].concat(from), tos = [].concat(to); // 组合变异：同时拆掉互相冗余的几道防线
    if (froms.some((f) => !text.includes(f))) { check(`变异“${name}”：要改的源码片段存在`, false, "片段没找到：" + froms.find((f) => !text.includes(f)).slice(0, 60)); continue; }
    froms.forEach((f, i) => { text = text.replace(f, tos[i]); });
    writeFileSync(p, text);
    const r = run();
    const fails = (r.stdout.match(/^❌/gm) || []).length;
    check(`变异“${name}”：删除账号迟到隔离专项变红（失败或挂住都算红，exit=${r.status}，红 ${fails} 项）`, r.status !== 0 && r.status !== null, `exit=${r.status}`);
  }
} finally { rmSync(W, { recursive: true, force: true }); }
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
