# 用真实 Python 验证所有关卡的答案（python3 scripts/verify-content.py，或 npm run verify:content）。
# 每段程序在全新的变量空间里运行，单次最多 2 秒（超时算失败）。
# - predict：恰好一个正确选项；正确选项 = 真实输出；错误选项 ≠ 真实输出。
# - fill：标准答案运行结果 = expected；把所有词块组合都跑一遍，任何能得到 expected 的组合都必须被列为可接受答案
#         （answer 或 answers），否则学生写对了会被判错；initial 不能直接得到 expected。组合超过 400 种只验标准答案（计为“跳过”）。
# - order：每个 answers 都得到 expected；所有排列都跑一遍（≤ 7 行），能得到 expected 的排列都必须在 answers 里。超过 7 行只验 answers（计为“跳过”）。
# 最后打印：运行次数、检查项、跳过项、失败项。有失败时退出码 1。
import json, sys, io, signal, itertools, contextlib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RUN_S = 2.0
runs = 0

class Timeout(Exception): pass
def _alarm(*_): raise Timeout()
signal.signal(signal.SIGALRM, _alarm)

def run(code):
    """返回 (输出, 错误类型或 None)。输出去掉末尾一个换行。"""
    global runs; runs += 1
    buf = io.StringIO(); err = None
    signal.setitimer(signal.ITIMER_REAL, RUN_S)
    try:
        with contextlib.redirect_stdout(buf):
            exec(compile(code, "<题目>", "exec"), {"__name__": "__main__"})
    except Timeout: err = "Timeout"
    except BaseException as e: err = type(e).__name__
    finally: signal.setitimer(signal.ITIMER_REAL, 0)
    out = buf.getvalue()
    return (out[:-1] if out.endswith("\n") else out), err

# 已知问题：在别的 PR 里修，单独列出，不算通过也不让本脚本失败。修好合并后从这里删掉。
KNOWN = {"U1L5-Q4": "干扰项 60 本身就能输出正确结果，PR #16 修复"}
known_hits = []
checked, skipped, fails, pending = 0, [], [], []
def ok(cond, where, msg):
    global checked; checked += 1
    if not cond:
        key = where.split("(")[0]
        (known_hits if key in KNOWN else fails).append(f"{where}：{msg}" + (f"（已知：{KNOWN[key]}）" if key in KNOWN else ""))

def fill_code(ex, combo):
    c = ex["code"]
    for i, t in enumerate(combo): c = c.replace("{%d}" % i, t, 1)
    return c

course = json.loads((ROOT / "content/course.json").read_text())
for u in course["units"]:
    if not u.get("file"): continue
    unit = json.loads((ROOT / "content" / u["file"]).read_text())
    for l in unit["lessons"]:
        for pt in l.get("pending", []): pending.append(f"{l['id']}（{pt['type']}）：{pt['plan']}")
        for pt in l.get("pending", []):
            for ti, t in enumerate(pt.get("tests", []), 1):  # 参考答案先用真实 Python 跑通，留给代码题运行器
                pre = "".join(f"{k} = {v!r}\n" for k, v in t["data"].items())
                out, err = run(pre + pt["reference"]); ok(err is None and out == t["stdout"], f"{l['id']}-pending-T{ti}", f"参考答案得到 {out!r}/{err}，期望 {t['stdout']!r}")
        for qi, ex in enumerate(l["exercises"], 1):
            w = f"{l['id']}-Q{qi}({ex['type']})"
            if ex["type"] == "predict":
                out, err = run(ex["code"])
                ok(err is None, w, f"程序出错 {err}")
                cor = [o for o in ex["options"] if o["correct"]]
                ok(len(cor) == 1, w, f"正确选项有 {len(cor)} 个")
                if cor: ok(cor[0]["text"] == out, w, f"正确选项 {cor[0]['text']!r} ≠ 真实输出 {out!r}")
                for o in ex["options"]:
                    if not o["correct"]: ok(o["text"] != out, w, f"错误选项 {o['text']!r} 其实就是真实输出")
            elif ex["type"] == "fill":
                n = ex["code"].count("{")
                accepted = [list(a) for a in ex.get("answers", [ex["answer"]])]
                ok(list(ex["answer"]) in accepted, w, "answer 不在 answers 里")
                for a in accepted:
                    out, err = run(fill_code(ex, a)); ok(err is None and out == ex["expected"], w, f"可接受答案 {a} 得到 {out!r}/{err}，期望 {ex['expected']!r}")
                combos = len(ex["tokens"]) ** n
                if combos > 400: skipped.append(f"{w}：词块组合 {combos} 种，只验了标准答案"); continue
                for combo in itertools.product(ex["tokens"], repeat=n):
                    combo = list(combo)
                    if combo in accepted: continue
                    out, err = run(fill_code(ex, combo))
                    ok(not (err is None and out == ex["expected"]), w, f"组合 {combo} 也能得到期望输出，但会被判错（加进 answers）")
                if ex.get("initial"):
                    out, err = run(fill_code(ex, ex["initial"])); ok(not (err is None and out == ex["expected"]), w, "initial 不用改就已经正确")
            elif ex["type"] == "order":
                lines = ex["lines"]; acc = [list(a) for a in ex["answers"]]
                ok(sorted(ex["shuffled"]) == list(range(len(lines))), w, "shuffled 不是全部行的排列")
                ok(list(ex["shuffled"]) not in acc, w, "打乱后的顺序本身就是答案")
                for a in acc:
                    out, err = run("\n".join(lines[k] for k in a)); ok(err is None and out == ex["expected"], w, f"答案 {a} 得到 {out!r}/{err}")
                if len(lines) > 7: skipped.append(f"{w}：{len(lines)} 行，没有穷举排列"); continue
                seen = set()
                for p in itertools.permutations(range(len(lines))):
                    text = "\n".join(lines[k] for k in p)
                    if list(p) in acc or text in seen: continue
                    seen.add(text)
                    if text in {"\n".join(lines[k] for k in a) for a in acc}: continue  # 行内容相同的等价排列
                    out, err = run(text)
                    ok(not (err is None and out == ex["expected"]), w, f"排列 {list(p)} 也能得到期望输出，但会被判错（加进 answers）")
            else:
                skipped.append(f"{w}：题型 {ex['type']} 本脚本不验证")

for s in skipped: print("⏭️ ", s)
for s in pending: print("🔒 待代码题运行器，未开放、未验证：", s)
for f in known_hits: print("⚠️ ", f)
for f in fails: print("❌", f)
print(f"\n真实运行 {runs} 次（单次上限 {RUN_S} 秒）；检查 {checked} 项，跳过 {len(skipped)} 项，已知问题 {len(known_hits)} 项，待代码题运行器 {len(pending)} 项，失败 {len(fails)} 项")
sys.exit(1 if fails else 0)
