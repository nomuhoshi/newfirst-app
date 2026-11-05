// 反向验证：把关键隔离逻辑故意拆掉，登录/同步专项测试必须变红。
// 做法：把 src/ 和专项测试复制到临时目录，只改一处源码，再跑同一个测试文件；不改工作区文件。
// 运行：node tests/sync-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const TEST = join("tests", "login-sync-hardening.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };

const W = mkdtempSync(join(tmpdir(), "sp-sync-mutation-"));
const TMP_SRC = join(W, "src"), TMP_TEST = join(W, TEST);
function resetSource() {
  rmSync(TMP_SRC, { recursive: true, force: true });
  cpSync(join(ROOT, "src"), TMP_SRC, { recursive: true });
}
try {
  resetSource();
  cpSync(join(ROOT, "tests", "fixtures"), join(W, "tests", "fixtures"), { recursive: true });
  cpSync(join(ROOT, TEST), TMP_TEST);
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));

  const run = () => spawnSync(process.execPath, [TMP_TEST], { cwd: W, encoding: "utf8", timeout: 60000 });
  const baseline = run();
  check("未改源码的对照：专项测试全绿", baseline.status === 0, (baseline.stdout + baseline.stderr).split("\n").slice(-4).join(" | "));

  const mutations = [
    {
      name: "项目命名空间失效（两个 Supabase 项目共用本机键）",
      file: "sync.js",
      from: 'return projectId && projectId !== "cloud-off"',
      to: 'return false && projectId !== "cloud-off"',
    },
    {
      name: "XP 合并改成相加（重复同步会重复加分）",
      file: "account-data.js",
      from: "out[field][k] = Math.max(L[field][k] ?? 0, R[field][k] ?? 0);",
      to: "out[field][k] = (L[field][k] ?? 0) + (R[field][k] ?? 0);",
    },
    {
      name: "凭证项目检查失效（错误项目的令牌会被拿去联网）",
      file: "sync.js",
      from: "if (projectId && (r.project || legacyProject) !== projectId) {",
      to: "if (false) {",
    },
    {
      name: "强制退出也删除未上传的本机副本",
      file: "sync.js",
      from: "if (force && pending) setCurrentAccount(storage, null); else logoutLocal(storage, uid);",
      to: "logoutLocal(storage, uid);",
    },
    {
      name: "测试入口的 localhost 覆盖不检查正式项目",
      file: "cloud-config.js",
      from: 'if (IS_PREVIEW && isProdUrl(url)) return { url: "", anonKey: "" };',
      to: 'if (false) return { url: "", anonKey: "" };',
    },
    {
      name: "旧 true 格式一律当作已导入（游客新增进度被静默忽略）",
      file: "account-data.js",
      from: 'if (prev === true) return guestCoveredByCloud(guestState, c.doc) ? "same" : "changed";',
      to: 'if (prev === true) return "same";',
    },
  ];

  for (const m of mutations) {
    resetSource();
    const path = join(TMP_SRC, m.file);
    const before = readFileSync(path, "utf8");
    if (!before.includes(m.from)) { check(`故障注入「${m.name}」能施加到源码上`, false, "找不到要替换的代码"); continue; }
    writeFileSync(path, before.replace(m.from, m.to));
    const r = run();
    const output = (r.stdout || "") + (r.stderr || "");
    const red = output.split("\n").filter((line) => line.startsWith("❌")).length;
    check(`故障注入「${m.name}」被测试抓到（不是永远通过）`, r.status !== 0 && red > 0, `退出码 ${r.status}，变红 ${red} 项`);
  }
} finally {
  rmSync(W, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n反向验证：共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
