# 代码题（pending 里的 modify / write，待 Claude 的代码题运行器）：题目页还没接上，不开放。
# 这里只用真实 Python 跑参考答案（reference）和 tests[]（data → stdout），确认题目本身可做；没有参考答案的计为跳过。
from .common import run, Check
def check(lessons):
    c = Check("代码题 pending")
    for l in lessons:
        for pi, pt in enumerate(l.get("pending", []), 1):
            w = f"{l['id']}-pending{pi}({pt['type']})"
            c.notes.append(f"{w}：{pt['plan']}（替换第 {pt.get('replaces', '?')} 题）")
            if not pt.get("reference") and not pt.get("task"): c.skip(w, "还没有参考答案和测试"); continue
            for ti, t in enumerate(pt.get("tests", []), 1):
                pre = "".join(f"{k} = {v!r}\n" for k, v in t.get("data", {}).items())
                out, err = run(pre + pt["reference"]); c.ok(err is None and out == t["stdout"], f"{w}-T{ti}", f"参考答案得到 {out!r}/{err}，期望 {t['stdout']!r}")
            if "replaces" in pt: c.ok(1 <= pt["replaces"] <= len(l["exercises"]), w, "replaces 指向的题不存在")
    return c

# 有 task（#19 格式）的代码题：参考答案全过；要改的程序 / 起始代码至少错一个且不卡死；两级提示；公开和隐藏测试都有；id 唯一；示范代码输出属实。
# U4L6-M1 专门教“死循环超时后怎么改”：起始代码必须超时（运行器显示超时/输出超限，不算作答、不扣红心）。
EXPECT_HANG = {"U4L6-M1"}
_orig_check = check
def _go(src, t):
    pre = "".join(f"{k} = {v!r}\n" for k, v in t.get("data", {}).items())
    return run(pre + src)

# ---- call 模式（U8 起）：先运行学生代码，再调用 t["call"]["fn"](*args, **kwargs)，按返回值比较（不比 print 的输出）。
# 比较规则和 src/judge.js 里 callHarness 的 _jg_same 一致（布尔和数字不混；数字按值比较，小数用相对误差；元组≡列表；字典键按字符串）。
_JG_SAME = """
def _jg_same(a, e, tol):
    if isinstance(e, bool) or isinstance(a, bool):
        return isinstance(e, bool) and isinstance(a, bool) and a == e
    if isinstance(e, (int, float)):
        if not isinstance(a, (int, float)):
            return False
        return abs(a - e) <= tol * max(1.0, abs(e))
    if isinstance(e, list):
        return isinstance(a, (list, tuple)) and len(a) == len(e) and all(_jg_same(x, y, tol) for x, y in zip(a, e))
    if isinstance(e, dict):
        return isinstance(a, dict) and {str(k): v for k, v in a.items()}.keys() == e.keys() and all(_jg_same(v, e[str(k)], tol) for k, v in a.items())
    return type(a) is type(e) and a == e
"""
def _call_ok(src, t):
    """(是否通过, 说明)：返回 (True, '') 或 (False, 实际返回值 / 错误类型)。
    返回值和学生的 print 输出走两条独立的通道（和 src/judge.js 一样：判题代码把结果写进单独的结果文件，不读标准输出），
    所以学生先 print(…, end="")、甚至打印 "@@OK" 之类的文字，都不会影响判断。"""
    import json, os, tempfile
    c = t["call"]
    fd, path = tempfile.mkstemp(suffix=".json", prefix="calljudge-"); os.close(fd)
    harness = (_JG_SAME + f"\n_a = {c['fn']}(*{c.get('args', [])!r}, **{c.get('kwargs', {})!r})\n"
               f"import json as _j\n"
               f"with open({path!r}, 'w', encoding='utf-8') as _fh:\n"
               f"    _fh.write(_j.dumps({{'ok': bool(_jg_same(_a, {t['expectedReturn']!r}, {t.get('tol', 1e-9)!r})), 'actual': repr(_a)[:200]}}, ensure_ascii=False))\n")
    try:
        out, err = run(src + "\n" + harness)
        if err is not None: return False, err
        raw = open(path, encoding="utf-8").read()
        if not raw: return False, "没有得到返回值"
        r = json.loads(raw)
        return bool(r["ok"]), ("" if r["ok"] else r["actual"])
    finally:
        try: os.remove(path)
        except OSError: pass

_SELFTEST_DONE = []
def _selftest_call(c):
    """call 判分自检（每次验证只跑一遍）：学生的 print 输出不能影响返回值的判断。"""
    if _SELFTEST_DONE: return
    _SELFTEST_DONE.append(1)
    T = {"name": "t", "call": {"fn": "f", "args": [8]}, "expectedReturn": 24}
    cases = [
        ('def f(x):\n    print("调试", end="")\n    return x * 3\n', True, "先 print(…, end=\"\") 再正确返回：通过"),
        ('def f(x):\n    print("调试")\n    return x * 3\n', True, "先 print 再正确返回：通过"),
        ('def f(x):\n    print("@@OK")\n    return x * 2\n', False, "打印 @@OK 但返回值错：不通过"),
        ('def f(x):\n    print(x * 3)\n', False, "只 print 了正确的数、没有 return：不通过"),
        ('print("顶层输出", end="")\ndef f(x):\n    return x * 3\n', True, "顶层有不换行的输出，函数返回值对：通过"),
        ('def f(x):\n    return str(x * 3)\n', False, "返回文字 \"24\" 不等于数字 24：不通过"),
        ('def f(x):\n    return True\n', False, "返回 True 不等于数字 24（布尔和数字不混）：不通过"),
    ]
    for src, want, why in cases: c.ok(_call_ok(src, T)[0] == want, "call判分自检", why)
def _passes(src, t, mode):
    """学生代码 / 参考答案在这一组测试上是否通过（output 模式比较标准输出，call 模式比较返回值）。"""
    if mode == "call": return _call_ok(src, t)[0]
    out, err = _go(src, t); return err is None and out.rstrip("\n") == t["expected"]
def check(lessons):
    c = _orig_check(lessons); ids = set()
    for l in lessons:
        for pt in l.get("pending", []):
            k = pt.get("task")
            if not k: continue
            w = k["id"]; c.ok(w not in ids, w, "id 重复"); ids.add(w)
            mode = k.get("checkMode")
            c.ok(k["type"] in ("modify", "write") and mode in ("output", "call"), w + "-格式", "type/checkMode 不对")
            c.ok(len(k.get("hints", [])) == 2, w + "-提示", "提示不是两级")
            ts = k.get("tests", [])
            c.ok(any(not t.get("hidden") for t in ts) and any(t.get("hidden") for t in ts), w + "-测试", "缺公开或隐藏测试")
            if mode == "call":
                _selftest_call(c)
                c.ok(all(isinstance(t.get("call"), dict) and "expectedReturn" in t for t in ts), w + "-call格式", "call 模式的测试要有 call 和 expectedReturn")
                c.ok(len({t["name"] for t in ts}) == len(ts), w + "-测试名", "测试名重复")
                for t in ts:
                    ok, info = _call_ok(k["reference"], t)
                    c.ok(ok, f"{w}-参考-{t['name']}", f"参考答案返回 {info!r}，期望 {t['expectedReturn']!r}")
                for ai, a in enumerate(k.get("alternatives", []), 1):
                    bad = [t["name"] for t in ts if not _call_ok(a, t)[0]]
                    c.ok(not bad, f"{w}-其他写法{ai}", f"其他写法没通过：{bad}")
                for wi, wa in enumerate(k.get("wrongAnswers", []), 1):
                    c.ok(any(not _call_ok(wa["code"], t)[0] for t in ts), f"{w}-错误写法{wi}", "标成错误写法的代码却通过了全部测试")
                src = k.get("code") if k["type"] == "modify" else k.get("starter")
                c.ok(any(not _call_ok(src, t)[0] for t in ts), w + "-起始不能直接过", "起始代码已经全部通过")
                wk = k.get("worked")
                if wk:
                    o, e = run(wk["code"]); c.ok(e is None and o.rstrip("\n") == wk["output"], w + "-示范", f"示范输出 {o!r}/{e}")
                continue
            for t in ts:
                out, err = _go(k["reference"], t)
                c.ok(err is None and out.rstrip("\n") == t["expected"], f"{w}-参考-{t['name']}", f"得到 {out!r}/{err}，期望 {t['expected']!r}")
            src = k.get("code") if k["type"] == "modify" else k.get("starter")
            res = [_go(src, t) for t in ts]
            hang = any(e == "Timeout" for _, e in res)
            if w in EXPECT_HANG: c.ok(hang, w + "-起始应超时", "这题教死循环恢复，起始代码应当超时"); c.ok(all(o == "" for o, _ in res), w + "-超时前无输出", "起始代码在循环里输出，可能先触发输出上限而不是超时")
            else: c.ok(not hang, w + "-起始不卡死", "起始代码卡死")
            c.ok(any(e is not None or o.rstrip("\n") != t["expected"] for (o, e), t in zip(res, ts)), w + "-起始不能直接过", "起始代码已经全部通过")
            wk = k.get("worked")
            if wk:
                o, e = run(wk["code"]); c.ok(e is None and o.rstrip("\n") == wk["output"], w + "-示范", f"示范输出 {o!r}/{e}")
    return c

# variation 草稿（字段待 Claude 确认）：solution 全过；starter 至少错一个且不卡死；两级提示；公开+隐藏测试；id 唯一；
# 父题 reference 至少过不了一个 variation 隐藏测试（数据和要求都变了，不能照抄父题）。
_check2 = check
def check(lessons):
    c = _check2(lessons); ids = set()
    for l in lessons:
        for pt in l.get("pending", []):
            k = pt.get("task") or {}
            v = k.get("variation")
            if not v: continue
            w = v["id"]; c.ok(w not in ids and w != k["id"], w, "variation id 重复"); ids.add(w)
            c.ok(k.get("requiresVariationAfterSolution") is True, w + "-父题标记", "父题缺 requiresVariationAfterSolution")
            c.ok(len(v.get("hints", [])) == 2, w + "-提示", "提示不是两级")
            ts = v.get("tests", []); hid = [t for t in ts if t.get("hidden")]
            c.ok(hid and any(not t.get("hidden") for t in ts), w + "-测试", "缺公开或隐藏测试")
            mode = k.get("checkMode")
            if mode == "call":
                c.ok(all(isinstance(t.get("call"), dict) and "expectedReturn" in t for t in ts), w + "-call格式", "call 模式的测试要有 call 和 expectedReturn")
                for t in ts:
                    ok, info = _call_ok(v["solution"], t); c.ok(ok, f"{w}-答案-{t['name']}", f"变化题答案返回 {info!r}，期望 {t['expectedReturn']!r}")
                c.ok(any(not _call_ok(v["starter"], t)[0] for t in ts), w + "-起始不能直接过", "起始代码已全过")
                c.ok(any(not _call_ok(k["reference"], t)[0] for t in hid), w + "-父题答案不能过", "父题 reference 能过全部隐藏测试")
                c.ok(len({repr(t["expectedReturn"]) for t in ts}) >= 2, w + "-期望互不相同", "变化题测试的期望返回值至少要有两种")
                continue
            for t in ts:
                o, e = _go(v["solution"], t); c.ok(e is None and o == t["expected"], f"{w}-答案-{t['name']}", f"得到 {o!r}/{e}")
            res = [(_go(v["starter"], t), t) for t in ts]
            c.ok(all(e != "Timeout" for (o, e), t in res), w + "-起始不卡死", "卡死")
            c.ok(any(e or o != t["expected"] for (o, e), t in res), w + "-起始不能直接过", "起始代码已全过")
            c.ok(any(_go(k["reference"], t) != (t["expected"], None) for t in hid), w + "-父题答案不能过", "父题 reference 能过全部隐藏测试")
    return c
