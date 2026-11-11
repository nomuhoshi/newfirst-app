# 填空题（fill）：合并了 PR #16 verify-fill.py 的逻辑。
# - 每个可接受答案的真实输出 = expected；
# - 所有词块组合都跑一遍（单空时就是 verify-fill 的“每个词块”），能得到 expected 的组合必须被列为可接受答案；
# - 单空题记录每个错误词块的真实输出和解释，--verbose 时打印，供人工核对解释（verify-fill 的输出）。
# - 任何组合都不能卡死（超时）：while 题里学生可能点出死循环，题目要避免。
# - 组合超过 400 种只验标准答案（计为跳过）；initial 不能直接得到 expected。
import itertools, re
from .common import run, Check
def fill_code(ex, combo):
    c = ex["code"]
    for i, t in enumerate(combo): c = c.replace("{%d}" % i, t, 1)
    return c
def check(items):
    c = Check("填空 fill")
    for w, l, ex in items:
        if ex["type"] != "fill": continue
        if "expected" not in ex: c.skip(w, "没有 expected"); continue
        n = len(re.findall(r"\{\d+\}", ex["code"]))  # 只数 {0} {1} 这样的空；字典写法 {"a": 1} 里的花括号不是空（和 src/app.js 的 /\{\d+\}/ 一致）
        accepted = [list(a) for a in ex.get("answers", [ex["answer"]])]
        c.ok(list(ex["answer"]) in accepted, w, "answer 不在 answers 里")
        for a in accepted:
            out, err = run(fill_code(ex, a)); c.ok(err is None and out == ex["expected"], w, f"可接受答案 {a} 得到 {out!r}/{err}，期望 {ex['expected']!r}")
        combos = len(ex["tokens"]) ** n
        if combos > 400: c.skip(w, f"词块组合 {combos} 种，只验了标准答案"); continue
        for combo in itertools.product(ex["tokens"], repeat=n):
            combo = list(combo)
            if combo in accepted: continue
            out, err = run(fill_code(ex, combo))
            c.ok(err != "Timeout", w, f"组合 {combo} 会卡死（超时），学生点到就停不下来，换掉这个词块")
            c.ok(not (err is None and out == ex["expected"]), w, f"组合 {combo} 也能得到期望输出，但会被判错（加进 answers）")
            if n == 1: c.notes.append(f"{w} [{combo[0]}] -> {(out if err is None else '<' + err + '>')!r} why: {ex.get('why', {}).get(combo[0], '')}")
        if ex.get("initial"):
            out, err = run(fill_code(ex, ex["initial"])); c.ok(not (err is None and out == ex["expected"]), w, "initial 不用改就已经正确")
    return c
