# 排序题（order）：每个 answers 都得到 expected；所有排列都跑一遍（≤ 8 行），能得到 expected 的排列都必须在 answers 里。
# 任何排列都不能卡死（超时）。
# 题目带 equivCases（变量 → 值的若干组）时：把行里的 “变量 = 值” 换成每组的值，可接受排列在每组下都必须和标准答案输出一样
# ——只接受真正等价的排列，不接受“这次数字碰巧对上”的排列。
import itertools, re
from .common import run, Check
MAX_LINES = 8
def with_case(lines, case):
    out = []
    for s in lines:
        m = re.match(r"^(\w+) = .+$", s)
        out.append(f"{m.group(1)} = {case[m.group(1)]!r}" if m and m.group(1) in case else s)
    return out
def check(items):
    c = Check("排序 order")
    for w, l, ex in items:
        if ex["type"] != "order": continue
        lines = ex["lines"]; acc = [list(a) for a in ex["answers"]]
        c.ok(sorted(ex["shuffled"]) == list(range(len(lines))), w, "shuffled 不是全部行的排列")
        c.ok(list(ex["shuffled"]) not in acc, w, "打乱后的顺序本身就是答案")
        for a in acc:
            out, err = run("\n".join(lines[k] for k in a)); c.ok(err is None and out == ex["expected"], w, f"答案 {a} 得到 {out!r}/{err}")
        for case in ex.get("equivCases", []):
            cl = with_case(lines, case); ref = run("\n".join(cl[k] for k in acc[0]))
            for a in acc[1:]:
                c.ok(run("\n".join(cl[k] for k in a)) == ref, w, f"答案 {a} 在 {case} 下和标准答案输出不同，不是真正等价")
        if len(lines) > MAX_LINES: c.skip(w, f"{len(lines)} 行，没有穷举排列"); continue
        accepted_text = {"\n".join(lines[k] for k in a) for a in acc}; seen = set()
        for p in itertools.permutations(range(len(lines))):
            text = "\n".join(lines[k] for k in p)
            if text in seen or text in accepted_text: continue
            seen.add(text)
            out, err = run(text)
            c.ok(err != "Timeout", w, f"排列 {list(p)} 会卡死（超时），题目要避免")
            c.ok(not (err is None and out == ex["expected"]) or bool(ex.get("equivCases")) and any(
                run("\n".join(with_case(lines, cs)[k] for k in p)) != run("\n".join(with_case(lines, cs)[k] for k in acc[0])) for cs in ex["equivCases"]),
                w, f"排列 {list(p)} 也能得到期望输出，但会被判错（加进 answers）")
    return c
