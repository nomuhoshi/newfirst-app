# 代码题（pending 里的 modify / write，待 Claude 的代码题运行器）：题目页还没接上，不开放。
# 这里只用真实 Python 跑参考答案（reference）和 tests[]（data → stdout），确认题目本身可做；没有参考答案的计为跳过。
from .common import run, Check
def check(lessons):
    c = Check("代码题 pending")
    for l in lessons:
        for pi, pt in enumerate(l.get("pending", []), 1):
            w = f"{l['id']}-pending{pi}({pt['type']})"
            c.notes.append(f"{w}：{pt['plan']}（替换第 {pt.get('replaces', '?')} 题）")
            if not pt.get("reference"): c.skip(w, "还没有参考答案和测试"); continue
            for ti, t in enumerate(pt.get("tests", []), 1):
                pre = "".join(f"{k} = {v!r}\n" for k, v in t.get("data", {}).items())
                out, err = run(pre + pt["reference"]); c.ok(err is None and out == t["stdout"], f"{w}-T{ti}", f"参考答案得到 {out!r}/{err}，期望 {t['stdout']!r}")
            if "replaces" in pt: c.ok(1 <= pt["replaces"] <= len(l["exercises"]), w, "replaces 指向的题不存在")
    return c
