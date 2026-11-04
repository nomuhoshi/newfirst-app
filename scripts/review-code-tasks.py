#!/usr/bin/env python3
"""代码题复核（程序员 Opus，2026-11-04）。用真实 Python 跑，判分规则模拟 src/judge.js 的 strict 比较。

用法：python3 scripts/review-code-tasks.py content/unit3.json content/unit4.json ...
      可选 --alts scripts/review-alternatives.json（默认就读这个文件）

每道 modify / write 题（lessons[].pending[].task，以后进 exercises 也一样）检查：
  1. 参考答案通过全部测试；
  2. modify 题的起始代码至少错一组（否则题目无效）；
  3. 只照抄公开测试、把输出写死的程序必须被隐藏测试抓到（防“答案写死”）；
  4. 至少 2 组公开测试、2 组隐藏测试（不足记“低”，新题按验收条件必须满足）；
  5. 示范代码（worked）不能包含完整参考答案；
  6. alternatives（合理写法）全部判对；wrongAnswers（常见错误写法）全部判错；
  7. 变化题：参考解法全过；原题答案过不了；写死公开输出过不了。
合理写法 / 错误写法来源：题目里的 task.alternatives / task.wrongAnswers 字段，加上 --alts 文件里按题号登记的。
退出码：有“错”或“中”时为 1。
"""
import contextlib, io, json, multiprocessing as mp, os, re, sys

def _target(code, data, q):
    g = dict(data); buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            exec(compile(code, "main.py", "exec"), g)
        q.put((buf.getvalue(), None))
    except BaseException as e:  # noqa: BLE001  学生代码什么都可能抛
        q.put((buf.getvalue(), type(e).__name__))

def run(code, data, timeout=2.0):
    q = mp.Queue(); p = mp.Process(target=_target, args=(code, data, q)); p.start(); p.join(timeout)
    if p.is_alive():
        p.kill(); p.join(); return None, "TIMEOUT"
    return q.get()

def norm(s):  # judge.js strict：统一换行，去掉末尾一个换行
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    return s[:-1] if s.endswith("\n") else s

def passes(code, tests):
    out = []
    for t in tests:
        o, e = run(code, t.get("data", {}))
        out.append(e is None and o is not None and norm(o) == norm(t["expected"]))
    return out

def hardcode(tests):
    vis = [t for t in tests if not t.get("hidden")]
    src = []
    for i, t in enumerate(vis):
        cond = " and ".join(f"{k} == {v!r}" for k, v in t.get("data", {}).items()) or "True"
        src.append(f"{'if' if i == 0 else 'elif'} {cond}:\n    print({t['expected']!r}, end='')")
    return "\n".join(src)

squash = lambda s: re.sub(r"\s+", "", s or "")

def iter_tasks(path):
    for L in json.load(open(path, encoding="utf-8"))["lessons"]:
        for p in L.get("pending", []):
            if isinstance(p.get("task"), dict):
                yield p["task"]
        for ex in L.get("exercises", []):
            if ex.get("type") in ("modify", "write"):
                yield ex

def main(argv):
    alts_path = "scripts/review-alternatives.json"
    if "--alts" in argv:
        i = argv.index("--alts"); alts_path = argv[i + 1]; del argv[i:i + 2]
    side = json.load(open(alts_path, encoding="utf-8")) if os.path.exists(alts_path) else {}
    probs = []
    def flag(level, tid, msg):
        probs.append((level, tid, msg)); print(f"  [{level}] {msg}")
    n = 0
    for path in argv:
        for t in iter_tasks(path):
            n += 1; tid = t["id"]; ts = t["tests"]; print(f"== {tid}")
            if not all(passes(t["reference"], ts)): flag("错", tid, "参考答案没有通过全部测试")
            if t["type"] == "modify" and all(passes(t.get("code", ""), ts)): flag("错", tid, "起始代码已经全过，题目无效")
            if all(passes(hardcode(ts), ts)): flag("错", tid, "照抄公开测试写死输出就能全过：隐藏测试不够")
            nv = sum(not x.get("hidden") for x in ts); nh = len(ts) - nv
            if nv < 2 or nh < 2: flag("低", tid, f"公开 {nv} 组 / 隐藏 {nh} 组（新题要求各 ≥2）")
            w = (t.get("worked") or {}).get("code", "")
            if w and squash(t["reference"]) in squash(w): flag("中", tid, "示范代码包含完整参考答案（泄题）")
            extra = side.get(tid, {})
            alts = list(t.get("alternatives", [])) + list(extra.get("alternatives", []))
            wrongs = list(t.get("wrongAnswers", [])) + list(extra.get("wrongAnswers", []))
            for a in alts:
                if not all(passes(a, ts)): flag("中", tid, "合理写法被判错：" + a.replace("\n", " ⏎ ")[:100])
            for wa in wrongs:
                code = wa["code"] if isinstance(wa, dict) else wa
                if all(passes(code, ts)): flag("错", tid, "错误写法被判对（测试抓不到这个误解）：" + code.replace("\n", " ⏎ ")[:100])
            if not alts: flag("低", tid, "没有登记任何合理写法")
            v = t.get("variation") or t.get("variant")
            if v:
                vid = v.get("id", tid + "-V"); vt = v["tests"]; sol = v.get("solution") or v.get("reference", "")
                if not all(passes(sol, vt)): flag("错", vid, "变化题参考解法没有全过")
                if all(passes(t["reference"], vt)): flag("错", vid, "原题答案能直接通过变化题")
                if all(passes(hardcode(vt), vt)): flag("错", vid, "变化题写死公开输出就能全过")
    print(f"\n检查 {n} 道代码题；问题 {len(probs)} 条")
    for p in probs: print("  ", *p)
    return 1 if any(p[0] in ("错", "中") for p in probs) else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
