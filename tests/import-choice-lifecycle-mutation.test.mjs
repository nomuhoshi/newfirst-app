// G-LOGIN-11：逐项撤掉恢复选择弹窗的保护，必须由对应行为断言检出。
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'g11-choice-mutation-'));
const test = 'tests/import-choice-lifecycle.test.mjs';
const variants = [
  ['处理函数不拦连点', 'if (!isActive() || busy) return;', 'if (!isActive()) return;', 'G11_BUSY'],
  ['不禁用三个按钮', 'controls.forEach((b) => { b.disabled = value; });', '', 'G11_DISABLED'],
  ['忙时允许 Esc / 遮罩关闭', '}, { canClose: () => !busy, onClose: () => { closed = true; } });', '}, { canClose: () => true, onClose: () => { closed = true; } });', 'G11_CLOSE'],
  ['稍后再说处理函数不拦忙时关闭', 'const later = button("稍后再说", () => { if (isActive() && !busy) closeOwn(); },', 'const later = button("稍后再说", () => { closeOwn(); },', 'G11_CLOSE'],
  ['迟到结果不检查原弹窗有效性', '          if (!isActive()) return;', '', 'G11_LATE'],
  ['不收起 stale 旧弹窗', 'if (r.stale || r.kind === "session-changed") { closeOwn(); return; }', '', 'G11_STALE'],
  ['会话变化仍提示游客重试', 'r.stale || r.kind === "session-changed"', 'r.stale', 'G11_SESSION_CHANGED'],
  ['失败后不恢复控件', 'finally { if (isActive()) setBusy(false); }', 'finally {}', 'G11_REENABLE'],
  ['关闭旧弹窗抢走新弹窗焦点', 'if (keepFocus && focused.isConnected) focused.focus?.({ preventScroll: true });', '', 'G11_FOCUS'],
];
const run = () => spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(dir, test)], { encoding: 'utf8', timeout: 20000 });
function checked(r, label) {
  assert.equal(r.error, undefined, label + ' 执行异常或超时');
  assert.equal(r.signal, null, label + ' 被信号中断');
  assert.doesNotMatch(r.stdout + r.stderr, /SyntaxError|ERR_MODULE_NOT_FOUND|cancelledByParent/);
  assert.match(r.stdout, /# cancelled 0/);
}
try {
  mkdirSync(join(dir, 'tests'));
  cpSync(join(root, test), join(dir, test));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
  const reset = () => { rmSync(join(dir, 'src'), { recursive: true, force: true }); cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true }); };
  reset(); const control = run(); checked(control, '对照');
  assert.equal(control.status, 0, control.stdout + control.stderr);
  const count = /# tests (\d+)/.exec(control.stdout)?.[1];
  assert.ok(count, '对照没有测试计数');
  console.log('PASS G11 未变异对照：' + count + '/' + count);
  for (const [name, from, to, marker] of variants) {
    reset(); const path = join(dir, 'src/account-ui.js'), src = readFileSync(path, 'utf8');
    assert.equal(src.split(from).length - 1, 1, '锚点须唯一：' + name);
    writeFileSync(path, src.replace(from, to));
    const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8', timeout: 5000 });
    assert.equal(syntax.status, 0, '变异语法错误：' + name + '\n' + syntax.stderr);
    const r = run(); checked(r, name);
    assert.equal(r.status, 1, '变异未被检出：' + name + '\n' + r.stdout + r.stderr);
    assert.match(r.stdout, /code: 'ERR_ASSERTION'/);
    assert.ok(r.stdout.includes(marker), '须命中目标断言 ' + marker + '：' + name);
    console.log('PASS G11 变异被断言检出：' + name + ' (' + marker + ', exit=1)');
  }
  console.log('G-LOGIN-11 mutation: control + ' + variants.length + ' mutants passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
