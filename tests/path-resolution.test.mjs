// 回归：测试里定位 dist / 项目根目录不能用 new URL(…, import.meta.url).pathname。
// 项目放在含中文、空格等字符的路径下时，.pathname 返回的是百分号编码（%E4%B8%AD…、%20），
// 拿它去 resolve / readFile 会指向一个不存在的目录，整组浏览器测试一起找不到 dist。正确写法是 fileURLToPath。
// 本测试：A. 静态检查——tests 目录下不再有 .pathname 写法；
//        B. 中文 + 空格路径场景——把各测试文件里真实的 “const DIST/ROOT = …” 行取出来，放进中文路径下执行，
//           结果必须是真实存在的目录；同时演示旧写法在这个路径下确实会指向不存在的位置（证明这条测试能抓到问题）。
// 运行：node tests/path-resolution.test.mjs（不需要浏览器 / 构建）
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS = fileURLToPath(new URL(".", import.meta.url));
const files = readdirSync(TESTS, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? readdirSync(join(TESTS, e.name)).filter((n) => n.endsWith(".mjs")).map((n) => join(TESTS, e.name, n)) : e.name.endsWith(".mjs") ? [join(TESTS, e.name)] : []));
// scripts/ 下的运行器（如 scripts/run-tests.mjs，npm test 靠它找项目根目录）也要检查
const SCRIPTS = fileURLToPath(new URL("../scripts/", import.meta.url));
const scriptFiles = readdirSync(SCRIPTS).filter((n) => /\.(mjs|js|cjs)$/.test(n)).map((n) => join(SCRIPTS, n));
const OLD = new RegExp("new URL\\([^)]*import\\.meta\\.url\\)\\s*\\.pathname");

test("A 测试文件和 scripts/ 里没有 new URL(…, import.meta.url).pathname 的写法", () => {
  const bad = [...files, ...scriptFiles].filter((f) => f !== fileURLToPath(import.meta.url)).filter((f) => OLD.test(readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "")));
  assert.deepEqual(bad.map((f) => basename(f)), []);
});

test("B 中文 + 空格路径下：测试里真实的 DIST / ROOT 定位行都能指向真实存在的目录", () => {
  const base = mkdtempSync(join(tmpdir(), "sp-路径-"));
  try {
    const proj = join(base, "碎片 编程 项目（测试）");
    mkdirSync(join(proj, "tests", "webkit"), { recursive: true }); mkdirSync(join(proj, "dist"), { recursive: true });
    writeFileSync(join(proj, "dist", "index.html"), "<!doctype html>");
    // 取出每个测试文件里定位 DIST / ROOT 的那一行（原样），放到同样深度的中文路径下执行
    const lines = [];
    for (const f of files) {
      const m = readFileSync(f, "utf8").split("\n").find((l) => /^const (DIST|ROOT)\b.*import\.meta\.url/.test(l));
      if (m) lines.push({ name: basename(f), sub: relative(TESTS, dirname(f)), line: m }); // 子目录（webkit / e2e / helpers）原样保留深度
    }
    assert.ok(lines.length >= 15, "应当能找到各测试文件里的定位行，实际 " + lines.length);
    for (const { name, sub, line } of lines) {
      const dir = join(proj, "tests", sub);
      mkdirSync(dir, { recursive: true });
      const probe = join(dir, "probe-" + name);
      writeFileSync(probe, `import { resolve, join, dirname } from "node:path";\nimport { fileURLToPath } from "node:url";\nimport { existsSync, statSync } from "node:fs";\n${line}\nconst p = typeof DIST === "string" ? DIST : ROOT;\nconsole.log(JSON.stringify({ p, ok: existsSync(p) && statSync(p).isDirectory() }));\n`);
      const r = spawnSync(process.execPath, [probe], { encoding: "utf8" });
      assert.equal(r.status, 0, `${name} 在中文路径下执行失败：${r.stderr}`);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true, `${name} 的定位行在中文路径下指向了不存在的目录：${out.p}`);
      assert.ok(out.p.includes("碎片 编程 项目（测试）"), `${name} 的结果不是真实路径（被百分号编码了？）：${out.p}`);
    }
    // 对照：旧写法在这个路径下确实会错（证明这条测试不是永远通过）
    const oldProbe = join(proj, "tests", "probe-old.mjs");
    writeFileSync(oldProbe, `import { existsSync } from "node:fs";\nimport { resolve } from "node:path";\nconst D = resolve(new URL("../dist", import.meta.url).pathname);\nconsole.log(JSON.stringify({ p: D, ok: existsSync(D) }));\n`);
    const o = JSON.parse(spawnSync(process.execPath, [oldProbe], { encoding: "utf8" }).stdout);
    assert.equal(o.ok, false, "对照失败：旧写法在中文路径下居然能找到目录：" + o.p);
    assert.match(o.p, /%/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
