#!/usr/bin/env python3
"""Transactionally and idempotently apply A/G dual-engine SW and background recovery tests."""
import argparse
import os
from pathlib import Path
import sys
import tempfile
from typing import Optional

COMPANION_TESTS = (
    "tests/sw-webkit-capability.test.mjs",
    "tests/progress-background-recovery.test.mjs",
)

RUNNER_ENTRIES = (
    '"../sw-webkit-capability.test.mjs"',
    '"../sw-update-engines.test.mjs"',
    '"../progress-background-recovery.test.mjs"',
)


class TransactionalApplyError(RuntimeError):
    def __init__(self, apply_error: Exception, unrestored: list[tuple[Path, Exception]]) -> None:
        self.apply_error = apply_error
        self.unrestored = unrestored
        super().__init__(str(apply_error))


def write_staged_bytes(target: Path, data: bytes) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{target.name}.stage.", dir=str(target.parent))
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        return Path(tmp_name)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def commit_staged_file(stage_path: Path, target_path: Path) -> None:
    os.replace(stage_path, target_path)


def rollback_committed(committed: list[Path], originals: dict[Path, Optional[bytes]]) -> list[tuple[Path, Exception]]:
    unrestored: list[tuple[Path, Exception]] = []
    for target in reversed(committed):
        orig = originals.get(target)
        try:
            if orig is None:
                try:
                    target.unlink()
                except FileNotFoundError:
                    pass
            else:
                restore_stage = write_staged_bytes(target, orig)
                try:
                    os.replace(restore_stage, target)
                except Exception:
                    try:
                        restore_stage.unlink()
                    except OSError:
                        pass
                    raise
        except Exception as rb_exc:
            unrestored.append((target, rb_exc))
    return unrestored


def apply_transactional_writes(plan: list[tuple[Path, bytes]]) -> None:
    originals: dict[Path, Optional[bytes]] = {}
    for target, _ in plan:
        originals[target] = target.read_bytes() if target.exists() else None

    staged: list[tuple[Path, Path]] = []
    committed: list[Path] = []
    try:
        for target, data in plan:
            stage_path = write_staged_bytes(target, data)
            staged.append((stage_path, target))

        for stage_path, target in staged:
            commit_staged_file(stage_path, target)
            committed.append(target)
    except Exception as apply_exc:
        for stage_path, _ in staged:
            try:
                if stage_path.exists():
                    stage_path.unlink()
            except OSError:
                pass
        unrestored = rollback_committed(committed, originals)
        raise TransactionalApplyError(apply_exc, unrestored) from apply_exc


def build_sw_update_engines(base_source: str) -> str:
    replacements = [
        (
            'import { chromium } from "playwright";',
            'import { chromium, webkit } from "playwright";',
            1,
        ),
        (
            'const DIST = join(REPO, "dist");',
            'const DIST = join(REPO, "dist");\n'
            'const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";\n'
            'const engine = BNAME === "webkit" ? webkit : chromium;\n'
            'if (!existsSync(join(DIST, "index.html"))) { console.error(`SW_UPDATE_ENV_FAILED [${BNAME}] missing dist/index.html; run npm run build:ci first`); process.exit(2); }',
            1,
        ),
        (
            'const PORT = 4337, BASE = `http://localhost:${PORT}/`;',
            'let port = Number(process.env.SW_TEST_PORT || 0), BASE = "";',
            1,
        ),
        (
            'const url = new URL(req.url, BASE);',
            'const url = new URL(req.url, BASE || "http://localhost/");',
            1,
        ),
        (
            '}).listen(PORT, res); });',
            '}).listen(port, "127.0.0.1", () => { port = srv.address().port; BASE = `http://localhost:${port}/`; res(); }); });',
            1,
        ),
        (
            'const ctrlCache = (pg) => pg.evaluate(() => new Promise((res) => { navigator.serviceWorker.addEventListener("message", (e) => e.data?.type === "version" && res(e.data.cache)); navigator.serviceWorker.controller.postMessage({ type: "version" }); setTimeout(() => res(null), 4000); }));',
            'const ctrlVersion = (pg) => pg.evaluate(() => new Promise((res) => { if (!navigator.serviceWorker?.controller) return res(null); let done = false; const finish = (v) => { if (!done) { done = true; res(v); } }; const onMsg = (e) => { if (e.data?.type === "version") { navigator.serviceWorker.removeEventListener("message", onMsg); finish({ version: e.data.version, cache: e.data.cache }); } }; navigator.serviceWorker.addEventListener("message", onMsg); try { navigator.serviceWorker.controller.postMessage({ type: "version" }); } catch { navigator.serviceWorker.removeEventListener("message", onMsg); finish(null); return; } setTimeout(() => { navigator.serviceWorker.removeEventListener("message", onMsg); finish(null); }, 4000); }));\n'
            'const ctrlCache = async (pg) => (await ctrlVersion(pg))?.cache ?? null;',
            1,
        ),
        (
            'const newCtx = (browser) => browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });',
            'const newCtx = (browser) => browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine === chromium, serviceWorkers: "allow" });',
            1,
        ),
        (
            'const browser = await chromium.launch();',
            'let browser;\n'
            'try { browser = await engine.launch(); } catch (e) { console.error(`SW_UPDATE_ENV_FAILED [${BNAME}] browser launch failed: ${String(e.message).split("\\n")[0]}`); await stop().catch(() => {}); rmSync(tmp, { recursive: true, force: true }); process.exit(2); }',
            1,
        ),
        (
            'await (await navigator.serviceWorker.getRegistration()).update();',
            'await Promise.race([(await navigator.serviceWorker.getRegistration()).update(), new Promise((_, rej) => setTimeout(() => rej(new Error("sw update timeout")), 15000))]);',
            5,
        ),
        (
            'console.log(fail ? `\\n${fail} 项失败` : "\\n全部通过"); process.exit(fail ? 1 : 0);',
            'console.log(fail ? `\\n[${BNAME}] ${fail} 项失败` : `\\n[${BNAME}] 全部通过`); process.exit(fail ? 1 : 0);',
            1,
        ),
    ]

    out = base_source
    for old, new, expected_count in replacements:
        count = out.count(old)
        if count != expected_count:
            raise RuntimeError(f"Expected anchor {expected_count} time(s) (found {count}): {old!r}")
        out = out.replace(old, new)

    needle = '    await ctx.close();\n  }\n} finally { await browser.close();'
    if out.count(needle) != 1:
        raise RuntimeError("Expected closing block anchor in tests/sw-update-safe.test.mjs")

    second_save_case = '''
  // ===== 7. 更新流程中第二次本机 persist() 失败（controllerchange 阶段）：首次保存成功并发出 skipWaiting，激活后二次保存失败不刷新、保留内存增量 =====
  {
    root = DIST;
    const ctx = await newCtx(browser); const P = await open(ctx);
    const beforeCtrl = await ctrlVersion(P);
    root = makeVersion("v3-second-failure");
    await P.evaluate(async () => { await Promise.race([(await navigator.serviceWorker.getRegistration()).update(), new Promise((_, rej) => setTimeout(() => rej(new Error("sw update timeout")), 15000))]); });
    const hadWaiting = await waiting(P);
    await P.evaluate(() => {
      window.__noReload = "second-failure";
      window.__savePhase = "before-skipWaiting";
      window.__failLedgerWrite = false;
      window.__skipWaitingSent = false;
      window.__saveAttempts = [];
      window.__realSet2 = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        const key = String(k);
        if (key.includes("suipian.v4.tab.")) {
          const shouldFail = !!window.__failLedgerWrite;
          window.__saveAttempts.push({ phase: window.__savePhase, key, threw: shouldFail });
          if (shouldFail) throw new DOMException("full", "QuotaExceededError");
        }
        return window.__realSet2.call(this, k, v);
      };
      window.__realSwPostMessage = ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage = function (msg, transfer) {
        if (msg && msg.type === "skipWaiting" && !window.__skipWaitingSent) {
          window.__skipWaitingSent = true;
          window.__savePhase = "controllerchange-second-persist";
          const s = window.__app.getState();
          window.__beforeSecondXp = s.xp;
          window.__app.addXp(25, "U1L2", true);
          s.done.U1L2 = true;
          window.__app.addRun();
          window.__expectedSecondXp = s.xp;
          window.__failLedgerWrite = true;
        }
        return window.__realSwPostMessage.call(this, msg, transfer);
      };
    });
    await P.evaluate(() => window.__app.renderPath());
    const updateButton = P.locator("[data-update-now]");
    check("第二次失败前置：新版在等待且更新按钮可见", hadWaiting && (await updateButton.count()) === 1);
    await updateButton.tap();
    const secondAttempted = await waitFor(P, () => window.__skipWaitingSent === true && window.__saveAttempts.some((a) => a.phase === "controllerchange-second-persist" && a.threw === true) && !!document.querySelector(".toast"), 15000);
    await waitFor(P, async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return !r?.waiting;
    }, 10000);
    const afterCtrl = await ctrlVersion(P);
    const second = await P.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const s = window.__app.getState();
      return {
        noReload: window.__noReload === "second-failure",
        skipWaitingSent: window.__skipWaitingSent === true,
        saveAttempts: window.__saveAttempts,
        xpKept: s.xp === window.__expectedSecondXp && s.xp > window.__beforeSecondXp,
        doneKept: s.done.U1L2 === true,
        toast: document.querySelector(".toast")?.textContent || "",
        waitingAfter: !!reg?.waiting,
        controllerPresent: !!navigator.serviceWorker.controller,
      };
    });
    console.log("SW_SECOND_SAVE_FAILURE", JSON.stringify({ browser: BNAME, beforeCtrl, afterCtrl, ...second }));
    const firstPhaseClean = !second.saveAttempts.some((a) => a.phase === "before-skipWaiting" && a.threw);
    const secondPhaseFailed = second.saveAttempts.some((a) => a.phase === "controllerchange-second-persist" && a.threw);
    check("第二次保存失败：第一次 persist 成功并发出 skipWaiting，第二次在 controllerchange 真实尝试写账本并失败", secondAttempted && second.skipWaitingSent && firstPhaseClean && secondPhaseFailed, JSON.stringify(second.saveAttempts));
    check("第二次保存失败：页面未刷新、内存增量保留、toast 如实提示未刷新", second.noReload && second.xpKept && second.doneKept && /进度没能保存到本机.*没有刷新页面/.test(second.toast), second.toast);
    check("第二次保存失败：控制者已切换为新版本且历史缓存保留", afterCtrl?.cache === "suipian-v3-second-failure" && beforeCtrl?.cache && (await keys(P)).includes(beforeCtrl.cache), JSON.stringify({ beforeCtrl, afterCtrl }));
    await P.evaluate(() => {
      Storage.prototype.setItem = window.__realSet2;
      ServiceWorker.prototype.postMessage = window.__realSwPostMessage;
      window.__app.persist();
    });
    await ctx.close();
  }
'''
    return out.replace(needle, '    await ctx.close();\n  }\n' + second_save_case + '} finally { await browser.close();', 1)


def update_runner(runner_source: str) -> str:
    anchor = '"../progress-persistence.test.mjs"'
    if anchor not in runner_source:
        raise RuntimeError(f"Expected anchor {anchor} in tests/webkit/run.mjs")
    missing = [entry for entry in RUNNER_ENTRIES if entry not in runner_source]
    if not missing:
        return runner_source
    return runner_source.replace(anchor, anchor + ", " + ", ".join(missing), 1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply A/G test files transactionally and idempotently.")
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Directory containing source tests/ files (defaults to script parent repo).",
    )
    args = parser.parse_args()

    root = Path.cwd().resolve()
    src_root = args.source_dir.resolve()

    base_sw_test = root / "tests/sw-update-safe.test.mjs"
    runner_path = root / "tests/webkit/run.mjs"
    pkg_path = root / "package.json"
    if not base_sw_test.is_file() or not runner_path.is_file() or not pkg_path.is_file():
        print("Error: run from repository root containing package.json, tests/sw-update-safe.test.mjs, and tests/webkit/run.mjs", file=sys.stderr)
        return 1

    plan: list[tuple[Path, bytes]] = []
    for rel in COMPANION_TESTS:
        dst = (root / rel).resolve()
        src = (src_root / rel).resolve()
        if not src.is_file():
            print(f"Error: required test file missing at {src}", file=sys.stderr)
            return 1
        plan.append((dst, src.read_bytes()))

    try:
        engines_bytes = build_sw_update_engines(base_sw_test.read_text(encoding="utf-8")).encode("utf-8")
        runner_bytes = update_runner(runner_path.read_text(encoding="utf-8")).encode("utf-8")
    except Exception as exc:
        print(f"Error during pre-flight transformation: {exc}", file=sys.stderr)
        return 1

    plan.append(((root / "tests/sw-update-engines.test.mjs").resolve(), engines_bytes))
    plan.append((runner_path.resolve(), runner_bytes))

    try:
        apply_transactional_writes(plan)
    except TransactionalApplyError as exc:
        if exc.unrestored:
            failed_targets = "; ".join(
                f"{target.relative_to(root) if target.is_relative_to(root) else target} ({err})"
                for target, err in exc.unrestored
            )
            print(
                f"Error applying files: {exc.apply_error}; ROLLBACK FAILED — unrestored targets: {failed_targets}",
                file=sys.stderr,
            )
        else:
            print(f"Error applying files (rolled back cleanly): {exc.apply_error}", file=sys.stderr)
        return 1

    print(
        "Applied cleanly:",
        ", ".join(str(target.relative_to(root)) for target, _ in plan),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
