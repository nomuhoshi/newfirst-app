// G-LOGIN-14 反向验证：未变异对照必须通过；每个变异必须由行为断言检出（退出码 1 + ERR_ASSERTION + 目标标记）。
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'g14-refresh-mutation-'));
const tests = 'tests/refresh-dedupe.test.mjs';
const KEY = 'if (!(flight && flight.gen === acctGen && flight.inst === loginInstanceId && flight.uid === userId && flight.rt === session.refreshToken)) flight = startRefresh(session, wait);';
const variants = [
  { name: '不合并：每个调用者都自己发刷新（原缺陷）', marker: 'G14_ONE', edits: [[KEY, 'flight = startRefresh(session, wait);']] },
  { name: '登记匹配不看来源刷新令牌', marker: 'G14_KEY_RT', edits: [[' && flight.rt === session.refreshToken)) flight = startRefresh', ')) flight = startRefresh']] },
  { name: '登记匹配不看账号代次', marker: 'G14_KEY_GEN', edits: [['(flight && flight.gen === acctGen && flight.inst', '(flight && flight.inst']] },
  { name: '旧刷新收尾无条件清登记（会清掉新登记）', marker: 'G14_FINALLY', edits: [['finally { if (refreshFlight === f) refreshFlight = null; }', 'finally { refreshFlight = null; }']] },
  { name: '登记从不释放（失败后重试仍拿旧结果）', marker: 'G14_RETRY', edits: [['finally { if (refreshFlight === f) refreshFlight = null; }', 'finally { }']] },
  { name: '旧刷新结果不核对代次 / 实例 / 会话就写进当前会话并落盘', marker: 'G14_ISOLATE', edits: [['mine() && session === base && checkSessionOwnership().ok\n        && r && r.ok', 'r && r.ok']] },
  { name: '等待方返回后不复核账号代次（被取代也继续）', marker: 'G14_ISOLATE', edits: [['    if (gen !== acctGen) return staleResult(); // 刷新期间退出 / 换了账号：旧的刷新结果不能写进新会话', '    // (变异) 不复核代次 // 刷新期间退出 / 换了账号：旧的刷新结果不能写进新会话']] },
  { name: '后到的等待方不认已被先到者采用的共享新凭证（误报认证失败）', marker: 'G14_ADOPT', edits: [['if ((adopted || session.refreshToken !== flight.rt) && session.expiresAt', 'if (adopted && session.expiresAt']] },
];
function reset() { rmSync(join(dir, 'src'), { recursive: true, force: true }); cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true }); }
const run = () => spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(dir, tests)], { encoding: 'utf8', timeout: 60000 });
function cleanRun(r, label) {
  assert.equal(r.error, undefined, label + ' 执行异常 / 超时');
  assert.equal(r.signal, null, label + ' 被信号终止');
  assert.doesNotMatch(r.stdout + r.stderr, /SyntaxError|ERR_MODULE_NOT_FOUND|cancelledByParent|TypeError|ReferenceError/);
  assert.match(r.stdout, /# cancelled 0/);
}
try {
  cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
  cpSync(join(root, tests), join(dir, tests));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
  const control = run(); cleanRun(control, '未变异对照');
  assert.equal(control.status, 0, control.stdout + control.stderr);
  console.log('PASS 未变异对照');
  for (const v of variants) {
    reset();
    const p = join(dir, 'src', 'sync.js'); let text = readFileSync(p, 'utf8');
    for (const [from, to, count = 1] of v.edits) {
      assert.equal(text.split(from).length - 1, count, '锚点数量不符：' + v.name + ' / ' + from.slice(0, 50));
      text = text.split(from).join(to);
    }
    writeFileSync(p, text);
    const syntax = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8', timeout: 5000 });
    assert.equal(syntax.status, 0, '变异语法错误：' + v.name + '\n' + syntax.stderr);
    const r = run(); cleanRun(r, v.name);
    assert.equal(r.status, 1, '变异未被检出：' + v.name + '\n' + r.stdout.slice(-800));
    assert.match(r.stdout, /code: 'ERR_ASSERTION'/, '须由断言检出：' + v.name);
    assert.ok(r.stdout.includes(v.marker), '须命中 ' + v.marker + '：' + v.name);
    console.log('PASS 变异被断言检出：' + v.name + ' (' + v.marker + ', exit=1)');
  }
  console.log('G-LOGIN-14 mutation: control + ' + variants.length + ' mutants passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
