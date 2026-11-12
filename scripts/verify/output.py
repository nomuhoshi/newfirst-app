# 选输出题（predict）：恰好一个正确选项；正确选项 = 真实输出；错误选项 ≠ 真实输出。
from .common import run, Check
def check(items):
    c = Check("选输出 predict")
    for w, l, ex in items:
        if ex["type"] != "predict": continue
        out, err = run(ex["code"])
        c.ok(err is None, w, f"程序出错 {err}")
        cor = [o for o in ex["options"] if o["correct"]]
        c.ok(len(cor) == 1, w, f"正确选项有 {len(cor)} 个")
        if cor: c.ok(cor[0]["text"] == out, w, f"正确选项 {cor[0]['text']!r} ≠ 真实输出 {out!r}")
        for o in ex["options"]:
            if not o["correct"]: c.ok(o["text"] != out, w, f"错误选项 {o['text']!r} 其实就是真实输出")
    return c
