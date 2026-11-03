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
_orig_check = check
def _go(src, t):
    pre = "".join(f"{k} = {v!r}\n" for k, v in t.get("data", {}).items())
    return run(pre + src)
def check(lessons):
    c = _orig_check(lessons); ids = set()
    for l in lessons:
        for pt in l.get("pending", []):
            k = pt.get("task")
            if not k: continue
            w = k["id"]; c.ok(w not in ids, w, "id 重复"); ids.add(w)
            c.ok(k["type"] in ("modify", "write") and k.get("checkMode") == "output", w + "-格式", "type/checkMode 不对")
            c.ok(len(k.get("hints", [])) == 2, w + "-提示", "提示不是两级")
            ts = k.get("tests", [])
            c.ok(any(not t.get("hidden") for t in ts) and any(t.get("hidden") for t in ts), w + "-测试", "缺公开或隐藏测试")
            for t in ts:
                out, err = _go(k["reference"], t)
                c.ok(err is None and out.rstrip("\n") == t["expected"], f"{w}-参考-{t['name']}", f"得到 {out!r}/{err}，期望 {t['expected']!r}")
            src = k.get("code") if k["type"] == "modify" else k.get("starter")
            res = [_go(src, t) for t in ts]
            c.ok(all(e is None or "超时" not in str(e) and "timeout" not in str(e).lower() for _, e in res), w + "-起始不卡死", "起始代码卡死")
            c.ok(any(e is not None or o.rstrip("\n") != t["expected"] for (o, e), t in zip(res, ts)), w + "-起始不能直接过", "起始代码已经全部通过")
            wk = k.get("worked")
            if wk:
                o, e = run(wk["code"]); c.ok(e is None and o.rstrip("\n") == wk["output"], w + "-示范", f"示范输出 {o!r}/{e}")
    return c
