# 出题工具（U10 起的生成脚本共用）：每道题的答案都由真实 Python 运行得出，不对就直接失败。
#   pred：选输出（第一个选项必须等于真实输出，其余必须不等于）
#   err：读报错（真实运行必须报错，记录类型、行号、报错前输出）
#   choose：选测试输入 / 选改法（每个选项带完整程序，只有第一个的输出 == fixed）
#   fill：填空（只有标准答案的词块得到期望输出；错误词块都要有解释）
#   order：排序（所有能得到同样输出的排列都收进 answers）
import itertools, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify.common import run, run_detail

ASK = "运行下面的程序，输出是什么？"

def pred(prompt, code, opts, tip):
    out, err = run(code); assert err is None, (code, err)
    assert opts[0][0] == out, f"正确选项 {opts[0][0]!r} ≠ 真实输出 {out!r}\n{code}"
    for t, _ in opts[1:]: assert t != out, f"错误选项就是真实输出：{t!r}"
    return {"type": "predict", "prompt": prompt, "code": code,
            "options": [{"text": t, "correct": i == 0, "why": w} for i, (t, w) in enumerate(opts)], "tip": tip}

def err(prompt, code, opts, tip, layout="text"):
    out, e, line, msg = run_detail(code); assert e, code
    ee = {"type": e, "line": line, "stdout": out}
    if f"{e}: {msg}" in prompt: ee["msg"] = msg
    d = {"type": "predict", "prompt": prompt, "code": code, "expectError": ee,
         "options": [{"text": t, "correct": i == 0, "why": w} for i, (t, w) in enumerate(opts)], "tip": tip}
    if layout: d["optionLayout"] = layout
    return d

def choose(prompt, code, fixed, opts, tip):
    # 选测试输入 / 选改法：每个选项带 program（选它之后真实运行的完整程序），只有输出 == fixed 的是正确选项（第一个）
    for i, (t, w, prog) in enumerate(opts):
        out, e = run(prog); good = e is None and out == fixed
        assert good == (i == 0), f"选项 {t!r}：输出 {out!r} / {e}，期望 {fixed!r}"
    return {"type": "predict", "prompt": prompt, "code": code, "fixed": fixed,
            "options": [{"text": t, "correct": i == 0, "why": w, "program": p} for i, (t, w, p) in enumerate(opts)], "tip": tip}

def fill(prompt, code, tokens, answer, why, hint):
    expected, e = run(code.replace("{0}", answer)); assert e is None, (code, e)
    acc = [answer]  # 界面的填空判分只认一个答案，所以除标准答案外的词块都必须得不到期望输出
    for t in tokens:
        o, e2 = run(code.replace("{0}", t))
        assert e2 != "Timeout", f"词块 {t!r} 会让程序停不下来（超时），学生点到就会卡住，换掉它"
        ok = e2 is None and o == expected
        assert ok == (t in acc), f"词块 {t!r}：输出 {o!r} / {e2}，期望 {expected!r}，可接受 {acc}"
        if t not in [answer]: assert t in why, f"词块 {t!r} 没有解释"
    return {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": [answer], "expected": expected, "why": why, "hint": hint}

def order(prompt, lines, shuffled, hint):
    expected, e = run("\n".join(lines)); assert e is None
    acc = sorted({tuple(p) for p in itertools.permutations(range(len(lines)))
                  if run("\n".join(lines[k] for k in p)) == (expected, None)})
    assert tuple(range(len(lines))) in acc and tuple(shuffled) not in acc
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": [list(a) for a in acc], "expected": expected, "hint": hint}

def lesson(unit, n, title, concept, story, intro, exs):
    assert len(story) <= 140, (n, len(story)); assert len(exs) == 4
    out, e = run(intro); assert e is None, intro
    return {"id": f"{unit}L{n}", "title": title, "concept": concept, "story": story, "introCode": intro, "exercises": exs}
