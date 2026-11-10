// 测试入口构建期校验（纯函数）：配置错误必须让构建失败，而不是静默变成“云端关闭”。运行：node --test tests/preview-cloud-check.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPreviewCloud, classifyKey, resolveSourceSha } from '../scripts/preview-cloud-check.mjs';
import { previewRows, formatClock } from '../src/preview-info.js';

const REF = 'abcdefghij0123456789';
const GOOD = { PREVIEW_ID: 'acc', TEST_SUPABASE_URL: `https://${REF}.supabase.co`, TEST_SUPABASE_ANON_KEY: 'sb_publishable_FAKEFAKEFAKE', REQUIRE_TEST_CLOUD: '1', EXPECTED_TEST_PROJECT_REF: REF };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload) => `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
const errs = (env) => checkPreviewCloud(env).errors.join(' | ');

test('C1: 正确的严格配置通过，并报告项目编号（不含密钥）', () => {
  const r = checkPreviewCloud(GOOD);
  assert.equal(r.ok, true, errs(GOOD)); assert.equal(r.info.ref, REF); assert.equal(r.info.mode, 'test-cloud'); assert.equal(r.info.keyKind, 'publishable');
  assert.doesNotMatch(JSON.stringify(r), /FAKEFAKE/, '检查结果里不能带密钥');
});
test('C2: 指向正式项目 → 失败（大小写 / 端口 / 用户信息 / 子路径都不能绕过）', () => {
  for (const url of ['https://aqlcunkmggzzvyavlkjg.supabase.co', 'HTTPS://AQLCUNKMGGZZVYAVLKJG.SUPABASE.CO:443/rest', 'https://user:pw@aqlcunkmggzzvyavlkjg.supabase.co/']) {
    assert.match(errs({ ...GOOD, TEST_SUPABASE_URL: url }), /正式/, url);
    assert.match(errs({ ...GOOD, TEST_SUPABASE_URL: url, REQUIRE_TEST_CLOUD: '' }), /正式/, url + '（宽松模式也拦）');
  }
});
test('C3: secret / service_role 密钥 → 失败（宽松模式也拦）', () => {
  for (const key of ['sb_secret_abcdef', jwt({ role: 'service_role', ref: REF })]) {
    assert.match(errs({ ...GOOD, TEST_SUPABASE_ANON_KEY: key }), /secret|service_role/, key.slice(0, 12));
    assert.match(errs({ ...GOOD, TEST_SUPABASE_ANON_KEY: key, REQUIRE_TEST_CLOUD: '' }), /secret|service_role/);
  }
  assert.equal(classifyKey(jwt({ role: 'anon', ref: REF })).kind, 'anon-jwt');
});
test('C4: 只给网址不给密钥（或反过来）/ 网址解析不了 → 失败', () => {
  assert.match(errs({ ...GOOD, TEST_SUPABASE_ANON_KEY: '' }), /没有 TEST_SUPABASE_ANON_KEY/);
  assert.match(errs({ ...GOOD, TEST_SUPABASE_URL: '' }), /没有 TEST_SUPABASE_URL/);
  assert.match(errs({ ...GOOD, TEST_SUPABASE_URL: 'not a url' }), /解析不了/);
});
test('C5: 严格模式——项目编号与期望不符 / 网址形式不对 / 密钥不像公开密钥 / 旧密钥属于别的项目 → 失败', () => {
  assert.match(errs({ ...GOOD, EXPECTED_TEST_PROJECT_REF: 'zzzzzzzzzzzzzzzzzzzz' }), /不是期望的测试项目/);
  assert.match(errs({ ...GOOD, TEST_SUPABASE_URL: `https://${REF}.supabase.co/rest/v1` }), /必须是 https/);
  assert.match(errs({ ...GOOD, TEST_SUPABASE_URL: `http://${REF}.supabase.co` }), /必须是 https/);
  assert.match(errs({ ...GOOD, TEST_SUPABASE_URL: 'https://127.0.0.1:5000' }), /必须是 https/);
  assert.match(errs({ ...GOOD, TEST_SUPABASE_ANON_KEY: 'whatever-key' }), /不像公开密钥/);
  assert.match(errs({ ...GOOD, TEST_SUPABASE_ANON_KEY: jwt({ role: 'anon', ref: 'otherprojectref00000' }) }), /不一致/);
});
test('C6: 严格模式没给云配置 → 失败；宽松模式没给 → 云端关闭（允许）；本机假服务器在宽松模式下允许', () => {
  assert.match(errs({ PREVIEW_ID: 'acc', REQUIRE_TEST_CLOUD: '1' }), /要求连接测试云项目/);
  const off = checkPreviewCloud({ PREVIEW_ID: 'acc' }); assert.equal(off.ok, true); assert.equal(off.info.mode, 'cloud-off');
  assert.equal(checkPreviewCloud({ PREVIEW_ID: 'login-sync', TEST_SUPABASE_URL: 'http://127.0.0.1:5999', TEST_SUPABASE_ANON_KEY: 'fake-anon' }).ok, true, '自动测试把测试云指向本机假服务器');
});
test('C7: 正式构建忽略 TEST_* 变量，且不能用严格模式', () => {
  const r = checkPreviewCloud({ TEST_SUPABASE_URL: `https://${REF}.supabase.co`, TEST_SUPABASE_ANON_KEY: 'sb_publishable_x' });
  assert.equal(r.ok, true); assert.equal(r.info.mode, 'prod-build'); assert.ok(r.notes.length);
  assert.match(errs({ REQUIRE_TEST_CLOUD: '1' }), /只能用于测试入口/);
});
test('C8: 源码提交号——显式 > GITHUB_SHA > git；不合法的值被忽略；都没有 = unknown', () => {
  const a = 'a'.repeat(40), b = 'b'.repeat(40);
  assert.equal(resolveSourceSha({ SOURCE_SHA: a, GITHUB_SHA: b }, () => 'c'.repeat(40)), a);
  assert.equal(resolveSourceSha({ GITHUB_SHA: b }, () => 'c'.repeat(40)), b);
  assert.equal(resolveSourceSha({ SOURCE_SHA: 'xyz', GITHUB_SHA: '' }, () => 'c'.repeat(40) + '-dirty'), 'c'.repeat(40) + '-dirty');
  assert.equal(resolveSourceSha({}, () => ''), 'unknown');
});
test('P1: 信息面板文案——SHA、云项目、同步状态、待办状态逐行可读；正式项目会被标红', () => {
  const rows = Object.fromEntries(previewRows({ sha: 'a'.repeat(40), previewId: 'acc', target: { mode: 'test', host: `${REF}.supabase.co`, ref: REF }, build: '2026-11-08T05:06:07.000Z',
    status: { status: 'synced', pending: false, lastSyncedAt: Date.UTC(2026, 10, 8, 5, 6, 7) }, account: { email: 'a@b.c', userId: 'u1234567890' }, recovery: 'none', online: true, tz: 'UTC' }));
  assert.equal(rows['源码提交'], 'a'.repeat(40)); assert.match(rows['云项目'], new RegExp(REF)); assert.equal(rows['同步状态'], '已同步 ✓'); assert.equal(rows['最近确认同步'], '05:06:07');
  assert.equal(rows['有待上传'], '否'); assert.equal(rows['游客导入待办'], '无'); assert.match(rows['账号'], /u1234567/);
  const prod = Object.fromEntries(previewRows({ sha: 'x', previewId: 'acc', target: { mode: 'prod', host: 'h', ref: '' }, status: {}, account: null }));
  assert.match(prod['云项目'], /正式项目/); assert.equal(prod['最近确认同步'], '—');
  // 退出后即使还有旧的时间戳也不显示（上一个账号的“最近确认同步”不能挂在游客状态上）
  const stale = Object.fromEntries(previewRows({ sha: 'x', previewId: 'acc', target: { mode: 'off' }, status: { status: null, lastSyncedAt: Date.UTC(2026, 10, 8, 5, 6, 7) }, account: null, tz: 'UTC' }));
  assert.equal(stale['最近确认同步'], '—');
  const loggedIn = Object.fromEntries(previewRows({ sha: 'x', previewId: 'acc', target: { mode: 'off' }, status: { status: 'synced' }, account: { userId: 'u1' }, tz: 'UTC' }));
  assert.equal(loggedIn['最近确认同步'], '本次打开后还没有');
  const locked = Object.fromEntries(previewRows({ sha: 'x', target: { mode: 'off' }, status: { status: 'import-recovery-required', pending: true }, account: { userId: 'u1' }, recovery: 'corrupt' }));
  assert.match(locked['同步状态'], /锁定/); assert.match(locked['游客导入待办'], /损坏/); assert.match(locked['云项目'], /关闭/);
  assert.equal(formatClock(NaN), '');
});
