// 判题核心（接口版）：只支持 U3「输出模式」——运行学生代码，比较标准输出。
// 不碰 XP / 红心 / 难度 / 解锁：这里只返回判题结果，由调用方决定怎么用。
//
// judge({ code, tests, checkMode, limits }, executor) -> Promise<{
//   status: "pass" | "fail" | "unavailable" | "internal-error",
//   cases: [{ name, hidden, ok, kind, ms, message, expected?, actual?, error? }],
//   totalMs,
// }>
//
// tests: [{ name, hidden?, data?, expected }]   data 是注入的变量（每组都是全新的变量空间）
// executor.exec({ code, data, timeoutMs }) -> Promise<{ stdout, error, timedOut, limitHit }>
//   - 每次调用必须是全新的全局变量（py-worker 的 _run 每次新建 ns，满足这一点）
//   - 抛出 { unavailable: true } 表示 Python 环境不可用（加载失败等）

export const JUDGE_LIMITS = { caseMs: 5000, totalMs: 10000 };

export const KIND = {
  PASS: "pass",
  WRONG: "wrong-output",
  ERROR: "error",
  CASE_TIMEOUT: "case-timeout",
  TOTAL_TIMEOUT: "total-timeout",
  OUTPUT_LIMIT: "output-limit",
};

export const MESSAGES = {
  [KIND.PASS]: "通过",
  [KIND.WRONG]: "输出和期望不一致",
  [KIND.ERROR]: "程序运行出错",
  [KIND.CASE_TIMEOUT]: "这一组测试运行超过 5 秒，可能有死循环",
  [KIND.TOTAL_TIMEOUT]: "全部测试合计超过 10 秒，后面的测试没有运行",
  [KIND.OUTPUT_LIMIT]: "输出太多，已停止",
  unavailable: "Python 环境暂时不可用，这次不算对错，请稍后重试",
  internal: "判题出了内部问题，这次不算对错",
};

// 比较规则：统一换行符，去掉每行行尾空白和末尾空行；其余必须完全一致
export function normalizeOutput(s) {
  return String(s ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "");
}

const now = () => (globalThis.performance ? performance.now() : Date.now());

export async function judge({ code, tests, checkMode = "output", limits = {} }, executor) {
  const L = { ...JUDGE_LIMITS, ...limits };
  const t0 = now();
  const done = (status, cases) => ({ status, cases, totalMs: Math.round(now() - t0) });
  if (checkMode !== "output") return done("internal-error", [{ name: "", hidden: false, ok: false, kind: "internal", message: `不支持的判题模式：${checkMode}` }]);
  if (!Array.isArray(tests) || tests.length === 0) return done("internal-error", [{ name: "", hidden: false, ok: false, kind: "internal", message: "没有测试用例" }]);

  const cases = [];
  let budgetHit = false;
  for (const t of tests) {
    const base = { name: t.name, hidden: !!t.hidden };
    const remaining = L.totalMs - (now() - t0);
    if (budgetHit || remaining <= 0) {
      budgetHit = true;
      cases.push({ ...base, ok: false, kind: KIND.TOTAL_TIMEOUT, ms: 0, message: MESSAGES[KIND.TOTAL_TIMEOUT] });
      continue;
    }
    const byTotal = remaining < L.caseMs; // 这一组的时限被总时限截短了
    const timeoutMs = Math.max(1, Math.min(L.caseMs, remaining));
    const c0 = now();
    let r;
    try {
      r = await executor.exec({ code, data: t.data ?? null, timeoutMs });
    } catch (e) {
      if (e && e.unavailable) return done("unavailable", [{ ...base, ok: false, kind: "unavailable", message: MESSAGES.unavailable }]);
      return done("internal-error", [{ ...base, ok: false, kind: "internal", message: MESSAGES.internal }]);
    }
    const ms = Math.round(now() - c0);
    let kind;
    if (r.timedOut) { kind = byTotal ? KIND.TOTAL_TIMEOUT : KIND.CASE_TIMEOUT; if (byTotal) budgetHit = true; }
    else if (r.limitHit) kind = KIND.OUTPUT_LIMIT;
    else if (r.error && r.error.kind === "InternalError") return done("internal-error", [{ ...base, ok: false, kind: "internal", message: MESSAGES.internal }]);
    else if (r.error) kind = KIND.ERROR;
    else kind = normalizeOutput(r.stdout) === normalizeOutput(t.expected) ? KIND.PASS : KIND.WRONG;
    const c = { ...base, ok: kind === KIND.PASS, kind, ms, message: MESSAGES[kind] };
    if (kind === KIND.ERROR) c.error = r.error;
    // 隐藏用例不暴露期望输出和实际输出
    if (!c.hidden && kind !== KIND.PASS) { c.expected = t.expected; c.actual = r.stdout ?? ""; }
    cases.push(c);
  }
  return done(cases.every((c) => c.ok) ? "pass" : "fail", cases);
}

// 浏览器适配：把现有 Runner（src/runner.js）包成 executor。
// Runner 用 onStatus/onOutput 回调，这里一次只跑一组；超时用 runner.stop()（会终止并重启工作线程）。
export function makeRunnerExecutor(runner, { waitReady = (r) => r.whenReady?.() } = {}) {
  return {
    async exec({ code, data, timeoutMs }) {
      await waitReady(runner);
      if (runner.state === "loadError") throw { unavailable: true };
      return new Promise((resolve, reject) => {
        let stdout = "";
        const prevStatus = runner.onStatus, prevOutput = runner.onOutput;
        const restore = () => { runner.onStatus = prevStatus; runner.onOutput = prevOutput; clearTimeout(timer); };
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; runner.stop(); }, timeoutMs);
        runner.onOutput = (t) => { stdout += t; };
        runner.onStatus = (s, info) => {
          if (s === "running" || s === "loading" || s === "ready" || s === "slowLoad") return;
          restore();
          if (s === "done") resolve({ stdout, error: info?.error ?? null, timedOut: false, limitHit: false });
          else if (s === "stopped" || s === "timeout") resolve({ stdout, error: null, timedOut: true, limitHit: false });
          else if (s === "outputLimit" || s === "outputLimitStopped") resolve({ stdout, error: null, timedOut: false, limitHit: true });
          else if (s === "loadError") reject({ unavailable: true });
          else reject(new Error("unknown status " + s));
        };
        if (!runner.run(code, data)) { restore(); reject({ unavailable: true }); }
      });
    },
  };
}
