// G-LOGIN-04 反向验证：未变异对照必须成功；变异必须被断言检出。
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'g04-resume-mutation-'));
const tests = 'tests/resume-guest-import-stale.test.mjs';
const mutation = (name, file, from, to) => ({ name, file, from, to });
const variants = [
  mutation('后发操作不再取代旧恢复', 'sync.js', 'resumeChoiceOp !== op || ', ''),
  mutation('本页身份防线整体失效（代次、账号、实例及验证流程互有冗余）', 'sync.js', 'op.gen !== acctGen || op.uid !== userId || op.inst !== loginInstanceId || op.verifyGen !== verifyGen || ', ''),
  mutation('恢复流程不查共享登录实例', 'sync.js', '      const own = checkSessionOwnership();\n      if (!own.ok) {\n        if (own.kind === "lost") { dropLostSession(own.reason); return staleImport(); }', '      const own = { ok: true };\n      if (!own.ok) {\n        if (own.kind === "lost") { dropLostSession(own.reason); return staleImport(); }'),
  mutation('刷新返回后不复查', 'sync.js', '      const afterToken = guardResumeChoice(); if (afterToken) return afterToken;\n', ''),
  mutation('云端读取返回后不复查（迟到失败会穿透）', 'sync.js', '      const afterRead = guardResumeChoice(); if (afterRead) return afterRead;\n', ''),
  mutation('写入选择 / 委托同步之前不复查', 'sync.js', '      const beforeChoice = guardResumeChoice(); if (beforeChoice) return beforeChoice;\n', ''),
  mutation('委托同步返回后不复查', 'sync.js', '        const afterSync = guardResumeChoice(); if (afterSync) return afterSync;\n', ''),
  mutation('旧操作 finally 清掉新操作登记', 'sync.js', '      if (resumeChoiceOp === op) resumeChoiceOp = null;', '      resumeChoiceOp = null;'),
  mutation('提交选择没有作废旧恢复', 'sync.js', '    resumeChoiceOp = null; // G-LOGIN-04：用户已提交选择，尚在读取的旧恢复不得再替换它\n', ''),
  mutation('恢复界面继续处理旧结果', 'account-ui.js', '      if (r.stale) return; // G-LOGIN-04：旧恢复结果不再提示、重绘或打开选择框\n', ''),
];
function reset() {
  rmSync(join(dir, 'src'), { recursive: true, force: true });
  cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
}
function run() {
  return spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(dir, tests)], { encoding: 'utf8', timeout: 20000 });
}
function cleanRun(r, label) {
  assert.equal(r.error, undefined, label + ' 执行异常 / 超时');
  assert.equal(r.signal, null, label + ' 被信号终止');
  assert.doesNotMatch(r.stdout + r.stderr, /SyntaxError|ERR_MODULE_NOT_FOUND|cancelledByParent/);
  assert.match(r.stdout, /# cancelled 0/);
}
try {
  cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
  cpSync(join(root, tests), join(dir, tests), { recursive: false });
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
  const control = run(); cleanRun(control, '未变异对照');
  assert.equal(control.status, 0, control.stdout + control.stderr);
  console.log('PASS 未变异对照');
  for (const v of variants) {
    reset();
    const p = join(dir, 'src', v.file), src = readFileSync(p, 'utf8');
    assert.equal(src.split(v.from).length - 1, 1, '锚点须唯一：' + v.name);
    writeFileSync(p, src.replace(v.from, v.to));
    const syntax = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8', timeout: 5000 });
    assert.equal(syntax.status, 0, '变异语法错误：' + v.name + '\n' + syntax.stderr);
    const r = run(); cleanRun(r, v.name);
    assert.equal(r.status, 1, '变异未被检出：' + v.name + '\n' + r.stdout + r.stderr);
    assert.match(r.stdout, /code: 'ERR_ASSERTION'/, '须由目标断言检出：' + v.name);
    console.log('PASS 变异被断言检出：' + v.name);
  }
  console.log('G-LOGIN-04 mutation: control + ' + variants.length + ' mutants passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
